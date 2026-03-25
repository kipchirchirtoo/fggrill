// Rust HTTP client — calls Node API and Python API with auth headers

use anyhow::{anyhow, Result};
use reqwest::Client;
use serde_json::Value;

const NODE_API: &str = "https://api.hirall.com";
const PYTHON_API: &str = "https://services.hirall.com";

pub struct ApiClient {
    client: Client,
    token: Option<String>,
    branch_id: Option<i64>,
}

impl ApiClient {
    pub fn new(token: Option<String>, branch_id: Option<i64>) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to build HTTP client"),
            token,
            branch_id,
        }
    }

    fn auth_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        if let Some(token) = &self.token {
            headers.insert(
                reqwest::header::AUTHORIZATION,
                format!("Bearer {token}").parse().unwrap(),
            );
        }
        if let Some(branch_id) = self.branch_id {
            headers.insert(
                "x-branch-id",
                branch_id.to_string().parse().unwrap(),
            );
        }
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            "application/json".parse().unwrap(),
        );
        headers
    }

    pub async fn get_node(&self, path: &str) -> Result<Value> {
        let url = format!("{NODE_API}/api{path}");
        let resp = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Node API error {}: {path}", resp.status()));
        }
        Ok(resp.json().await?)
    }

    pub async fn post_node(&self, path: &str, body: &Value) -> Result<Value> {
        let url = format!("{NODE_API}/api{path}");
        let resp = self
            .client
            .post(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Node API error {}: {path}", resp.status()));
        }
        Ok(resp.json().await?)
    }

    pub async fn put_node(&self, path: &str, body: &Value) -> Result<Value> {
        let url = format!("{NODE_API}/api{path}");
        let resp = self
            .client
            .put(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Node API error {}: {path}", resp.status()));
        }
        Ok(resp.json().await?)
    }

    pub async fn patch_node(&self, path: &str, body: &Value) -> Result<Value> {
        let url = format!("{NODE_API}/api{path}");
        let resp = self
            .client
            .patch(&url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Node API error {}: {path}", resp.status()));
        }
        Ok(resp.json().await?)
    }

    pub async fn delete_node(&self, path: &str, _body: &Value) -> Result<Value> {
        let url = format!("{NODE_API}/api{path}");
        let resp = self
            .client
            .delete(&url)
            .headers(self.auth_headers())
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Node API error {}: {path}", resp.status()));
        }
        Ok(serde_json::json!({ "success": true }))
    }

    pub async fn get_python(&self, path: &str) -> Result<Value> {
        let url = format!("{PYTHON_API}/api{path}");
        let resp = self
            .client
            .get(&url)
            .headers(self.auth_headers())
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Python API error {}: {path}", resp.status()));
        }
        Ok(resp.json().await?)
    }

    /// Ping the Node API health endpoint — returns true if reachable
    pub async fn ping_node() -> bool {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();
        client
            .get(format!("{NODE_API}/api/health"))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }

    /// Ping the Python API — returns true if reachable
    pub async fn ping_python() -> bool {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();
        client
            .get(format!("{PYTHON_API}/health"))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false)
    }
}
