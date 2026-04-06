---
name: java-setup-integration-tests
description: >
  Integration testing patterns for Java/Spring Boot services with Spock. Covers
  BaseIntegrationSpec setup, Testcontainers, mock frameworks, gRPC testing,
  REST controller testing, Kafka consumers, and GrpcMock for external services.
compatibility: Java services with Spring Boot and Spock
alwaysApply: false
metadata:
  version: "1.0.0"
  technology: java
  category: testing
  tags:
    - java
    - testing
    - integration-tests
    - spock
    - testcontainers
    - grpc
    - rest
    - kafka
---

# Java Integration Testing

Comprehensive integration testing patterns for Java/Spring Boot services using Spock Framework.

## When to use this skill

- Setting up integration tests for a new service
- Migrating from unit tests to proper integration tests
- Choosing mock strategy: GrpcMock/WireMock (preferred) vs @MockitoBean/@SpringBean (ProtoShims only)
- Configuring Testcontainers (PostgreSQL, Valkey/Redis)
- Testing gRPC handlers or external gRPC clients
- Testing REST controllers with MockMvc
- Testing Kafka consumers with EmbeddedKafka

## Skill Contents

### Sections

- [When to use this skill](#when-to-use-this-skill)
- [Quick Decision Tree](#quick-decision-tree)
- [Core Principles](#core-principles)
- [References](#references)
- [Related Skills](#related-skills)

### Available Resources

**📚 references/** - Detailed documentation

- [base spec patterns](references/base-spec-patterns.md)
- [container cleanup](references/container-cleanup.md)
- [container reuse](references/container-reuse.md)
- [grpc handler testing](references/grpc-handler-testing.md)
- [grpcmock resilience](references/grpcmock-resilience.md)
- [grpcmock setup](references/grpcmock-setup.md)
- [grpcmock stub helpers](references/grpcmock-stub-helpers.md)
- [kafka testing](references/kafka-testing.md)
- [migration workflow](references/migration-workflow.md)
- [rest controller testing](references/rest-controller-testing.md)
- [testcontainers setup](references/testcontainers-setup.md)

---

## Quick Decision Tree

```
What are you testing?
│
├─► Your own gRPC handlers?
│   └─► Use [grpc-handler-testing.md](references/grpc-handler-testing.md)
│       (In-process transport, GrpcClientTestConfig)
│
├─► External gRPC clients (retries/timeouts)?
│   └─► Use [grpcmock-setup.md](references/grpcmock-setup.md)
│       (WireMock-like stubbing for gRPC)
│
├─► REST controllers?
│   └─► Use [rest-controller-testing.md](references/rest-controller-testing.md)
│       (MockMvc, @AutoConfigureMockMvc)
│
├─► Kafka consumers?
│   └─► Use [kafka-testing.md](references/kafka-testing.md)
│       (@EmbeddedKafka, KafkaTestUtils)
│
├─► Setting up BaseIntegrationSpec?
│   └─► Use [base-spec-patterns.md](references/base-spec-patterns.md)
│       (Mock framework choice, reset strategies)
│
└─► Configuring containers?
    └─► Use [testcontainers-setup.md](references/testcontainers-setup.md)
        (PostgreSQL jdbc:tc, Valkey)
```

## Core Principles

### The Golden Rules

| Rule                                               | Why                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Real domain services**                           | Tests should exercise actual business logic                                  |
| **Real repositories**                              | Use Testcontainers for DB/cache                                              |
| **Prefer GrpcMock/WireMock for external services** | Tests real client wrappers, resilience, error codes                          |
| **Bean mocking only for ProtoShims/custom RPCs**   | Use `@MockitoBean`/`@SpringBean` only when GrpcMock/WireMock is not feasible |
| **Reset mocks in setup()**                         | Prevent test interference (@MockitoBean only)                                |
| **Clean data in cleanup()**                        | Ensure test isolation                                                        |
| **No `@DirtiesContext`**                           | Use proper cleanup instead                                                   |
| **No `@Transactional` on tests**                   | Let transactions commit to test real behavior                                |
| **Static containers**                              | Share across test classes for speed                                          |
| **Centralize config in BaseSpec**                  | All test beans and mocks in base class                                       |

### External Dependency Mocking Hierarchy

**Always prefer the highest-fidelity mock available:**

```
PREFER (most realistic)                    AVOID (least realistic)
─────────────────────────────────────────────────────────────────────
  GrpcMock          WireMock          @MockitoBean/@SpringBean
  (gRPC services)   (REST services)   (ONLY for ProtoShims/custom RPCs)
```

| External Dependency Type                                 | Mock Strategy                | Why                                                           |
| -------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| **Standard gRPC service**                                | **GrpcMock** (always)        | Tests real client wrapper, retry logic, error codes, timeouts |
| **Standard REST service**                                | **WireMock** (always)        | Tests real HTTP client, error handling, serialization         |
| **ProtoShim / custom RPC** (e.g., UserModel, TradeModel) | **@MockitoBean/@SpringBean** | Custom protocols not directly testable via GrpcMock           |
| **Kafka producer**                                       | **@MockitoBean/@SpringBean** | No network mock available                                     |

**Why GrpcMock/WireMock over bean mocking:**

- Tests the **real client wrapper** code (serialization, error mapping, retries)
- Catches bugs in client configuration and resilience patterns
- More realistic - simulates actual network behavior
- Single GrpcMock server handles ALL external gRPC services

### What to Mock vs Use Real

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Test JVM Process                              │
│                                                                      │
│  ┌─────────────────┐     ┌─────────────────────────────────────┐    │
│  │ Test Code       │     │      Spring Boot Context            │    │
│  │                 │     │                                     │    │
│  │ Direct API call │ ──► │  Handler / Controller               │    │
│  │ (stub or HTTP)  │     │         │                           │    │
│  │                 │     │         ▼                           │    │
│  │                 │     │  ┌─────────────────────┐            │    │
│  │                 │     │  │   Domain Service    │            │    │
│  │                 │     │  │   (REAL impl)       │            │    │
│  │                 │     │  │         │           │            │    │
│  │                 │     │  │    ┌────┴────┐      │            │    │
│  │                 │     │  │    ▼         ▼      │            │    │
│  │                 │     │  │ Repository  Cache   │            │    │
│  │                 │     │  │ (REAL)     (REAL)   │            │    │
│  │                 │     │  └─────────────────────┘            │    │
│  │                 │     │                                     │    │
│  │  GrpcMock/      │     │  gRPC Client ──────► GrpcMock      │    │
│  │  WireMock       │     │  (REAL wrapper)      Server        │    │
│  │  (preferred)    │     │                                     │    │
│  │                 │     │  REST Client ──────► WireMock       │    │
│  │  @SpringBean    │     │  (REAL wrapper)      Server        │    │
│  │  (ProtoShims    │     │                                     │    │
│  │   only)         │     │  ProtoShim ◄──── @SpringBean MOCK  │    │
│  │                 │     │  (custom RPC)                       │    │
│  └─────────────────┘     └─────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │   PostgreSQL    │  │     Valkey      │  │     Kafka       │     │
│  │  Testcontainer  │  │  Testcontainer  │  │  EmbeddedKafka  │     │
│  │  (if needed)    │  │  (if needed)    │  │  (if needed)    │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

### Mock Framework Choice

When bean mocking IS needed (ProtoShims/custom RPCs only):

| Approach    | Annotation     | Mock Syntax                             | Verification            | Reset Needed |
| ----------- | -------------- | --------------------------------------- | ----------------------- | ------------ |
| **Mockito** | `@MockitoBean` | `when(mock.method()).thenReturn(value)` | `verify(mock).method()` | Yes          |
| **Spock**   | `@SpringBean`  | `mock.method() >> value`                | `1 * mock.method()`     | No           |

**WARNING:** You cannot mix syntaxes! With `@MockitoBean`, Spock's `>>` syntax will NOT work.

See [base-spec-patterns.md](references/base-spec-patterns.md) for detailed examples.

---

## References

| Reference                                                           | Description                                       |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| [base-spec-patterns.md](references/base-spec-patterns.md)           | BaseIntegrationSpec patterns with mock frameworks |
| [testcontainers-setup.md](references/testcontainers-setup.md)       | Container configuration patterns                  |
| [grpc-handler-testing.md](references/grpc-handler-testing.md)       | Testing your own gRPC handlers                    |
| [grpcmock-setup.md](references/grpcmock-setup.md)                   | GrpcMock for external services                    |
| [rest-controller-testing.md](references/rest-controller-testing.md) | REST controller testing                           |
| [kafka-testing.md](references/kafka-testing.md)                     | Kafka consumer testing                            |

## Related Skills

| Skill                                                                | Purpose                    |
| -------------------------------------------------------------------- | -------------------------- |
| [java-testing](.claude/skills/java-testing/SKILL.md)                 | General testing guidelines |
| [java-coverage](.claude/skills/java-coverage/SKILL.md)               | JaCoCo coverage setup      |
| [grpc-services-rfc-33](.claude/skills/grpc-services-rfc-33/SKILL.md) | gRPC service standards     |

<!-- AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY -->
<!-- Source: bitsoex/ai-code-instructions → java/skills/java-setup-integration-tests/SKILL.md -->
<!-- To modify, edit the source file and run the distribution workflow -->
