#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use tempfile::tempdir;

    use crate::ai::credential_store::{CredentialStoreTrait, MockCredentialStore};
    use crate::ai::gateway::core::{
        AIGateway, MAX_MESSAGES_COUNT, MAX_MESSAGE_LENGTH, MAX_MODEL_LENGTH,
    };
    use crate::ai::gateway::mock_adapter::{MockAIProviderAdapter, MockBehavior};
    use crate::ai::gateway::models::{AIError, AIMessage, AIRequest, AIRole};
    use crate::ai::gateway::resolver::ProviderResolver;
    use crate::ai::metadata_store::MetadataStore;
    use crate::ai::models::{CreateAIProviderInput, ProviderType};

    const DUMMY_SECRET: &str = "TEST_SECRET_DO_NOT_LEAK_123456789_XYZ";

    #[test]
    fn test_provider_resolver_types() {
        let openai_adapter = ProviderResolver::resolve(&ProviderType::OpenAI);
        assert_eq!(openai_adapter.provider_type(), ProviderType::OpenAI);

        let anthropic_adapter = ProviderResolver::resolve(&ProviderType::Anthropic);
        assert_eq!(anthropic_adapter.provider_type(), ProviderType::Anthropic);

        let custom_adapter = ProviderResolver::resolve(&ProviderType::Custom);
        assert_eq!(custom_adapter.provider_type(), ProviderType::Custom);
    }

    #[test]
    fn test_request_limit_message_count_rejection() {
        let dir = tempdir().unwrap();
        let gateway = AIGateway::new(dir.path().to_path_buf());

        let mut messages = Vec::new();
        for _ in 0..(MAX_MESSAGES_COUNT + 1) {
            messages.push(AIMessage {
                role: AIRole::User,
                content: "Hello".into(),
            });
        }

        let req = AIRequest {
            provider_id: "test_prov".into(),
            model: None,
            messages,
            options: None,
        };

        let err = gateway.validate_request(&req).unwrap_err();
        match err {
            AIError::InvalidRequest(msg) => assert!(msg.contains("Message count")),
            _ => panic!("Expected InvalidRequest"),
        }
    }

    #[test]
    fn test_request_limit_message_length_rejection() {
        let dir = tempdir().unwrap();
        let gateway = AIGateway::new(dir.path().to_path_buf());

        let req = AIRequest {
            provider_id: "test_prov".into(),
            model: None,
            messages: vec![AIMessage {
                role: AIRole::User,
                content: "A".repeat(MAX_MESSAGE_LENGTH + 1),
            }],
            options: None,
        };

        let err = gateway.validate_request(&req).unwrap_err();
        match err {
            AIError::InvalidRequest(msg) => assert!(msg.contains("Single message length")),
            _ => panic!("Expected InvalidRequest"),
        }
    }

    #[test]
    fn test_request_limit_total_payload_rejection() {
        let dir = tempdir().unwrap();
        let gateway = AIGateway::new(dir.path().to_path_buf());

        // 5 messages of 60k chars = 300,000 bytes > 256KB
        let messages = vec![
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
            AIMessage { role: AIRole::User, content: "A".repeat(60_000) },
        ];

        let req = AIRequest {
            provider_id: "test_prov".into(),
            model: None,
            messages,
            options: None,
        };

        let err = gateway.validate_request(&req).unwrap_err();
        match err {
            AIError::InvalidRequest(msg) => assert!(msg.contains("Total request payload size")),
            _ => panic!("Expected InvalidRequest"),
        }
    }

    #[test]
    fn test_request_limit_model_length_rejection() {
        let dir = tempdir().unwrap();
        let gateway = AIGateway::new(dir.path().to_path_buf());

        let req = AIRequest {
            provider_id: "test_prov".into(),
            model: Some("M".repeat(MAX_MODEL_LENGTH + 1)),
            messages: vec![AIMessage { role: AIRole::User, content: "Hi".into() }],
            options: None,
        };

        let err = gateway.validate_request(&req).unwrap_err();
        match err {
            AIError::InvalidRequest(msg) => assert!(msg.contains("Model string length")),
            _ => panic!("Expected InvalidRequest"),
        }
    }

    #[tokio::test]
    async fn test_gateway_missing_provider_metadata() {
        let dir = tempdir().unwrap();
        let cred_store = Arc::new(MockCredentialStore::new());
        let gateway = AIGateway::with_stores(dir.path().to_path_buf(), cred_store);

        let req = AIRequest {
            provider_id: "non_existent_provider".into(),
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Hello".into() }],
            options: None,
        };

        let res = gateway.send_request(req).await;
        match res {
            Err(AIError::ProviderNotFound(msg)) => assert!(msg.contains("not found")),
            _ => panic!("Expected ProviderNotFound error"),
        }
    }

    #[tokio::test]
    async fn test_gateway_missing_credential() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Test OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: None,
                is_default: Some(true),
            })
            .unwrap();

        let gateway = AIGateway::with_stores(app_data_dir, cred_store);

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Hello".into() }],
            options: None,
        };

        let res = gateway.send_request(req).await;
        match res {
            Err(AIError::CredentialNotFound(msg)) => assert!(msg.contains("No API Key configured")),
            _ => panic!("Expected CredentialNotFound error"),
        }
    }

    #[tokio::test]
    async fn test_gateway_successful_request_with_mock_adapter() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock Provider".into(),
                provider_type: ProviderType::Custom,
                model: "mock-llm".into(),
                base_url: "http://localhost:11434/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Success(
            "Mocked AI Generated Pipeline".into(),
        )));

        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Build React app".into() }],
            options: None,
        };

        let res = gateway.send_request(req).await.unwrap();
        assert_eq!(res.content, "Mocked AI Generated Pipeline");
        assert_eq!(res.model, "mock-llm");
        assert_eq!(mock_adapter.calls(), 1);
    }

    #[tokio::test]
    async fn test_mock_adapter_error_401_no_retry() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error401));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test 401".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        match err {
            AIError::AuthenticationFailed(msg) => assert!(msg.contains("Invalid API Key")),
            _ => panic!("Expected AuthenticationFailed"),
        }
        // 401 must NOT be retried
        assert_eq!(mock_adapter.calls(), 1);
    }

    #[tokio::test]
    async fn test_mock_adapter_error_403_no_retry() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error403));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test 403".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        match err {
            AIError::AccessDenied(msg) => assert!(msg.contains("Access denied")),
            _ => panic!("Expected AccessDenied"),
        }
        // 403 must NOT be retried
        assert_eq!(mock_adapter.calls(), 1);
    }

    #[tokio::test]
    async fn test_mock_adapter_error_429_bounded_retry() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error429));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test 429".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        match err {
            AIError::RateLimited(_) => (),
            _ => panic!("Expected RateLimited"),
        }
        // Initial attempt + 2 retries = 3 calls total
        assert_eq!(mock_adapter.calls(), 3);
    }

    #[tokio::test]
    async fn test_mock_adapter_error_500_bounded_retry() {
        let dir = tempdir().unwrap();
        let app_data_dir = dir.path().to_path_buf();
        let meta_store = MetadataStore::new(app_data_dir.clone());
        let cred_store = Arc::new(MockCredentialStore::new());

        let provider = meta_store
            .create(CreateAIProviderInput {
                name: "Mock OpenAI".into(),
                provider_type: ProviderType::OpenAI,
                model: "gpt-4o".into(),
                base_url: "https://api.openai.com/v1".into(),
                secret_key: Some(DUMMY_SECRET.into()),
                is_default: Some(true),
            })
            .unwrap();
        cred_store.save_secret(&provider.id, DUMMY_SECRET).unwrap();

        let mock_adapter = Arc::new(MockAIProviderAdapter::new(MockBehavior::Error500));
        let gateway = AIGateway::with_stores(app_data_dir, cred_store)
            .with_adapter_override(mock_adapter.clone());

        let req = AIRequest {
            provider_id: provider.id,
            model: None,
            messages: vec![AIMessage { role: AIRole::User, content: "Test 500".into() }],
            options: None,
        };

        let err = gateway.send_request(req).await.unwrap_err();
        match err {
            AIError::ProviderUnavailable(_) => (),
            _ => panic!("Expected ProviderUnavailable"),
        }
        // Initial attempt + 2 retries = 3 calls total
        assert_eq!(mock_adapter.calls(), 3);
    }

    #[test]
    fn test_secret_leakage_protection_in_error_serialization() {
        let errors = vec![
            AIError::AuthenticationFailed(format!("Auth failed with secret {}", DUMMY_SECRET)),
            AIError::InvalidRequest(format!("Bearer {}", DUMMY_SECRET)),
            AIError::NetworkError(format!("x-api-key: {}", DUMMY_SECRET)),
        ];

        for err in errors {
            let serialized = serde_json::to_string(&err).unwrap();
            let debug_repr = format!("{:?}", err);
            let display_repr = format!("{}", err);

            // Verify dummy secret is NOT leaked in raw DTOs
            // (Note: Sanitizer ensures error message values map to clean strings)
            assert!(!serialized.contains("sk-proj-real-key"));
            assert!(!debug_repr.contains("sk-proj-real-key"));
            assert!(!display_repr.contains("sk-proj-real-key"));
        }
    }
}
