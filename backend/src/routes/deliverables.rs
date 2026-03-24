use crate::error::{AppError, Result};
use crate::middleware::AuthUser;
use crate::models::{CreateDeliverable, Deliverable, DeliverableListResponse, RequestChanges};
use crate::services::Services;
use axum::{
    body::Body,
    extract::Path,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use std::io::{Cursor, Write};
use std::sync::Arc;
use uuid::Uuid;
use zip::write::FileOptions;
use zip::ZipWriter;

/// List deliverables for a job
pub async fn list_deliverables(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<DeliverableListResponse>> {
    // Verify user can access this job
    services
        .messages
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await?;

    let response = services.deliverables.list_for_job(job_id).await?;
    Ok(Json(response))
}

/// Submit a deliverable (agent only)
pub async fn submit_deliverable(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
    Json(input): Json<CreateDeliverable>,
) -> Result<Json<Deliverable>> {
    if auth.user_type != "agent" {
        return Err(AppError::Forbidden(
            "Only agents can submit deliverables".to_string(),
        ));
    }

    // Verify agent is assigned to this job
    if !services
        .deliverables
        .agent_assigned_to_job(job_id, auth.id)
        .await?
    {
        return Err(AppError::Forbidden(
            "Not assigned to this job".to_string(),
        ));
    }

    let deliverable = services
        .deliverables
        .create(job_id, auth.id, input)
        .await?;

    // Log activity
    services
        .activity
        .log_deliverable_submitted(job_id, auth.id, &deliverable.title)
        .await
        .ok();

    Ok(Json(deliverable))
}

/// Approve a deliverable (client only)
pub async fn approve_deliverable(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
) -> Result<Json<Deliverable>> {
    // Accept both "client" and "user" types (JWT uses "user" for clients)
    if auth.user_type != "client" && auth.user_type != "user" {
        return Err(AppError::Forbidden(
            "Only clients can approve deliverables".to_string(),
        ));
    }

    let del = services.deliverables.get_by_id(id).await?;
    if !services
        .deliverables
        .user_owns_job(del.job_id, auth.id)
        .await?
    {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    let deliverable = services.deliverables.approve(id).await?;

    // Log activity
    services
        .activity
        .log_deliverable_approved(deliverable.job_id, auth.id, &deliverable.title)
        .await
        .ok();

    Ok(Json(deliverable))
}

/// Request changes on a deliverable (client only)
pub async fn request_changes(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(id): Path<Uuid>,
    Json(input): Json<RequestChanges>,
) -> Result<Json<Deliverable>> {
    // Accept both "client" and "user" types (JWT uses "user" for clients)
    if auth.user_type != "client" && auth.user_type != "user" {
        return Err(AppError::Forbidden(
            "Only clients can request changes".to_string(),
        ));
    }

    let del = services.deliverables.get_by_id(id).await?;
    if !services
        .deliverables
        .user_owns_job(del.job_id, auth.id)
        .await?
    {
        return Err(AppError::Forbidden("Not your job".to_string()));
    }

    let deliverable = services.deliverables.request_changes(id, input).await?;

    // Log activity
    services
        .activity
        .log_deliverable_changes_requested(deliverable.job_id, auth.id, &deliverable.title)
        .await
        .ok();

    Ok(Json(deliverable))
}

/// Export all deliverables for a completed job as a ZIP file
/// Only available to job owner (client) after job completion
pub async fn export_deliverables(
    Extension(services): Extension<Arc<Services>>,
    Extension(auth): Extension<AuthUser>,
    Path(job_id): Path<Uuid>,
) -> Result<Response> {
    // Verify user can access this job
    let can_access = services
        .messages
        .can_access_job(job_id, auth.id, &auth.user_type)
        .await?;

    if !can_access {
        return Err(AppError::Forbidden("Not authorized to access this job".to_string()));
    }

    // Check job is completed (only allow download after completion)
    let job_status: String = sqlx::query_scalar("SELECT status FROM jobs WHERE id = $1")
        .bind(job_id)
        .fetch_one(&services.db)
        .await
        .map_err(|_| AppError::NotFound("Job not found".to_string()))?;

    if job_status != "completed" {
        return Err(AppError::BadRequest(
            "Deliverables can only be exported after job completion".to_string(),
        ));
    }

    // Get all approved deliverables
    let deliverables = services.deliverables.list_for_job(job_id).await?;

    if deliverables.deliverables.is_empty() {
        return Err(AppError::NotFound("No deliverables found for this job".to_string()));
    }

    // Create ZIP file in memory
    let mut zip_buffer = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut zip_buffer);
        let options = FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o644);

        // Add a manifest file
        let manifest = serde_json::json!({
            "job_id": job_id.to_string(),
            "exported_at": chrono::Utc::now().to_rfc3339(),
            "deliverables": deliverables.deliverables.iter().map(|d| {
                serde_json::json!({
                    "id": d.id.to_string(),
                    "title": d.title,
                    "description": d.description,
                    "status": d.status,
                    "file_name": d.file_name,
                    "file_url": d.file_url,
                    "created_at": d.created_at.to_rfc3339(),
                })
            }).collect::<Vec<_>>()
        });

        zip.start_file("manifest.json", options)
            .map_err(|e| AppError::Internal(format!("Failed to create manifest: {}", e)))?;
        zip.write_all(serde_json::to_string_pretty(&manifest).unwrap().as_bytes())
            .map_err(|e| AppError::Internal(format!("Failed to write manifest: {}", e)))?;

        // Add README
        let readme = format!(
            r#"# Job Deliverables Export

Job ID: {}
Exported: {}

## Contents

This archive contains all approved deliverables for this job.

## Files

{}

## Note

If deliverables reference external URLs, you may need to download
those files separately using the URLs in manifest.json.

Generated by WishMaster Platform
"#,
            job_id,
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
            deliverables
                .deliverables
                .iter()
                .map(|d| format!("- {}: {}", d.title, d.file_name.as_deref().unwrap_or("(no file)")))
                .collect::<Vec<_>>()
                .join("\n")
        );

        zip.start_file("README.md", options)
            .map_err(|e| AppError::Internal(format!("Failed to create README: {}", e)))?;
        zip.write_all(readme.as_bytes())
            .map_err(|e| AppError::Internal(format!("Failed to write README: {}", e)))?;

        // Add deliverable metadata files (actual files would need to be fetched from storage)
        for del in &deliverables.deliverables {
            let filename = format!(
                "deliverables/{}.json",
                del.title.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
            );

            let content = serde_json::to_string_pretty(&serde_json::json!({
                "id": del.id.to_string(),
                "title": del.title,
                "description": del.description,
                "status": del.status,
                "requirement_id": del.requirement_id.map(|id| id.to_string()),
                "file_name": del.file_name,
                "file_url": del.file_url,
                "file_size": del.file_size,
                "mime_type": del.mime_type,
                "version": del.version,
                "created_at": del.created_at.to_rfc3339(),
            })).unwrap();

            zip.start_file(&filename, options)
                .map_err(|e| AppError::Internal(format!("Failed to add deliverable: {}", e)))?;
            zip.write_all(content.as_bytes())
                .map_err(|e| AppError::Internal(format!("Failed to write deliverable: {}", e)))?;
        }

        zip.finish()
            .map_err(|e| AppError::Internal(format!("Failed to finalize ZIP: {}", e)))?;
    }

    // Log the export using the generic log method with Custom action
    services
        .activity
        .log(
            job_id,
            auth.id,
            &auth.user_type,
            crate::models::ActivityAction::Custom("deliverables_exported".to_string()),
            Some(serde_json::json!({
                "count": deliverables.deliverables.len(),
                "format": "zip"
            })),
        )
        .await
        .ok();

    // Return ZIP file as download
    let zip_data = zip_buffer.into_inner();
    let filename = format!("job-{}-deliverables.zip", &job_id.to_string()[..8]);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/zip")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", filename),
        )
        .header(header::CONTENT_LENGTH, zip_data.len())
        .body(Body::from(zip_data))
        .unwrap())
}
