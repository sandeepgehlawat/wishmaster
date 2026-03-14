use crate::error::{Result, SdkError};

/// Data parser utilities
pub struct DataParser;

impl DataParser {
    /// Parse CSV data
    pub fn parse_csv(data: &[u8]) -> Result<Vec<Vec<String>>> {
        let text = String::from_utf8_lossy(data);
        let mut rows = Vec::new();

        for line in text.lines() {
            let cols: Vec<String> = line.split(',').map(|s| s.trim().to_string()).collect();
            rows.push(cols);
        }

        Ok(rows)
    }

    /// Parse JSON data
    pub fn parse_json<T: serde::de::DeserializeOwned>(data: &[u8]) -> Result<T> {
        serde_json::from_slice(data).map_err(SdkError::Serialization)
    }

    /// Parse JSON array
    pub fn parse_json_array(data: &[u8]) -> Result<Vec<serde_json::Value>> {
        serde_json::from_slice(data).map_err(SdkError::Serialization)
    }

    /// Parse key-value pairs (line format: key=value)
    pub fn parse_kv(data: &[u8]) -> Result<std::collections::HashMap<String, String>> {
        let text = String::from_utf8_lossy(data);
        let mut map = std::collections::HashMap::new();

        for line in text.lines() {
            if let Some((key, value)) = line.split_once('=') {
                map.insert(key.trim().to_string(), value.trim().to_string());
            }
        }

        Ok(map)
    }
}

/// Result builder utilities
pub struct ResultBuilder {
    results: serde_json::Map<String, serde_json::Value>,
}

impl ResultBuilder {
    pub fn new() -> Self {
        Self {
            results: serde_json::Map::new(),
        }
    }

    /// Add a string result
    pub fn add_string(mut self, key: &str, value: &str) -> Self {
        self.results.insert(key.to_string(), serde_json::Value::String(value.to_string()));
        self
    }

    /// Add a numeric result
    pub fn add_number(mut self, key: &str, value: f64) -> Self {
        self.results.insert(
            key.to_string(),
            serde_json::Value::Number(serde_json::Number::from_f64(value).unwrap()),
        );
        self
    }

    /// Add a boolean result
    pub fn add_bool(mut self, key: &str, value: bool) -> Self {
        self.results.insert(key.to_string(), serde_json::Value::Bool(value));
        self
    }

    /// Add a JSON value
    pub fn add_json(mut self, key: &str, value: serde_json::Value) -> Self {
        self.results.insert(key.to_string(), value);
        self
    }

    /// Add an array
    pub fn add_array<T: serde::Serialize>(mut self, key: &str, values: Vec<T>) -> Self {
        if let Ok(json) = serde_json::to_value(values) {
            self.results.insert(key.to_string(), json);
        }
        self
    }

    /// Add code output
    pub fn add_code(self, language: &str, code: &str) -> Self {
        self.add_json(
            "code",
            serde_json::json!({
                "language": language,
                "content": code
            }),
        )
    }

    /// Add file output
    pub fn add_file(self, filename: &str, content: &str, mime_type: &str) -> Self {
        self.add_json(
            "file",
            serde_json::json!({
                "filename": filename,
                "content": content,
                "mime_type": mime_type
            }),
        )
    }

    /// Build the final JSON result
    pub fn build(self) -> serde_json::Value {
        serde_json::Value::Object(self.results)
    }
}

impl Default for ResultBuilder {
    fn default() -> Self {
        Self::new()
    }
}
