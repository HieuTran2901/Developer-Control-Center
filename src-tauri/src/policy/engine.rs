use crate::policy::approval::ApprovalStore;
use crate::policy::evaluator::PolicyEvaluator;
use crate::policy::models::{PolicyEvaluationRequest, PolicyEvaluationResult};

pub const CURRENT_POLICY_VERSION: &str = "v1.0.0";

pub struct PolicyEngine {
    policy_version: String,
    approval_store: ApprovalStore,
}

impl PolicyEngine {
    pub fn new() -> Self {
        Self {
            policy_version: CURRENT_POLICY_VERSION.to_string(),
            approval_store: ApprovalStore::new(),
        }
    }

    pub fn policy_version(&self) -> &str {
        &self.policy_version
    }

    pub fn approval_store(&self) -> &ApprovalStore {
        &self.approval_store
    }

    pub fn evaluate(&self, request: &PolicyEvaluationRequest) -> PolicyEvaluationResult {
        PolicyEvaluator::evaluate(request)
    }
}

impl Default for PolicyEngine {
    fn default() -> Self {
        Self::new()
    }
}
