use crate::types::*;

/// Job matcher trait for filtering jobs
pub trait JobMatcher {
    fn matches(&self, job: &JobWithDetails) -> bool;
}

/// Match jobs by required skills
pub struct SkillMatcher {
    pub skills: Vec<String>,
    pub require_all: bool,
}

impl SkillMatcher {
    pub fn new(skills: Vec<String>) -> Self {
        Self {
            skills,
            require_all: false,
        }
    }

    pub fn require_all(mut self) -> Self {
        self.require_all = true;
        self
    }
}

impl JobMatcher for SkillMatcher {
    fn matches(&self, job: &JobWithDetails) -> bool {
        if self.skills.is_empty() {
            return true;
        }

        let job_skills: Vec<String> = job.job.required_skills
            .iter()
            .map(|s| s.to_lowercase())
            .collect();

        if self.require_all {
            self.skills.iter().all(|s| job_skills.contains(&s.to_lowercase()))
        } else {
            self.skills.iter().any(|s| job_skills.contains(&s.to_lowercase()))
        }
    }
}

/// Match jobs by budget range
pub struct BudgetMatcher {
    pub min: Option<f64>,
    pub max: Option<f64>,
}

impl BudgetMatcher {
    pub fn new(min: Option<f64>, max: Option<f64>) -> Self {
        Self { min, max }
    }
}

impl JobMatcher for BudgetMatcher {
    fn matches(&self, job: &JobWithDetails) -> bool {
        if let Some(min) = self.min {
            if job.job.budget_max < min {
                return false;
            }
        }

        if let Some(max) = self.max {
            if job.job.budget_min > max {
                return false;
            }
        }

        true
    }
}

/// Match jobs by task type
pub struct TaskTypeMatcher {
    pub task_types: Vec<String>,
}

impl TaskTypeMatcher {
    pub fn new(task_types: Vec<String>) -> Self {
        Self { task_types }
    }
}

impl JobMatcher for TaskTypeMatcher {
    fn matches(&self, job: &JobWithDetails) -> bool {
        if self.task_types.is_empty() {
            return true;
        }

        self.task_types.iter().any(|t| t.eq_ignore_ascii_case(&job.job.task_type))
    }
}

/// Combine multiple matchers
pub struct CombinedMatcher {
    matchers: Vec<Box<dyn JobMatcher + Send + Sync>>,
}

impl CombinedMatcher {
    pub fn new() -> Self {
        Self { matchers: vec![] }
    }

    pub fn add<M: JobMatcher + Send + Sync + 'static>(mut self, matcher: M) -> Self {
        self.matchers.push(Box::new(matcher));
        self
    }
}

impl JobMatcher for CombinedMatcher {
    fn matches(&self, job: &JobWithDetails) -> bool {
        self.matchers.iter().all(|m| m.matches(job))
    }
}

impl Default for CombinedMatcher {
    fn default() -> Self {
        Self::new()
    }
}
