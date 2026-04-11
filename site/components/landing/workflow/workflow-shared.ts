export type WorkflowExampleSpeaker = "user" | "agent" | "tool";

export type WorkflowExampleTurn = {
  speaker: WorkflowExampleSpeaker;
  text: string;
};

export const GAD_LOOP_DIAGRAM = `flowchart TD
    classDef user fill:#7c5f3b,stroke:#c88d4c,color:#fff,stroke-width:2px
    classDef cmd fill:#1e3a5f,stroke:#6f88a3,color:#e0b378,stroke-width:2px
    classDef sub fill:#0f2e1a,stroke:#00c16a,color:#d9fbe8,stroke-width:2px
    classDef state fill:#3a1e2d,stroke:#c88d4c,color:#ffe4b5,stroke-width:2px

    U[User prompt] --> S["gad snapshot<br/>(context hydrate)"]
    S --> CMD{slash command?}
    CMD -->|/gad:plan-phase| PP[plan-phase skill]
    CMD -->|/gad:execute-phase| EX[execute-phase skill]
    CMD -->|/gad:verify-work| VR[verify-phase skill]
    CMD -->|no| LOOP[pick one task]

    PP --> PLAN[gad-planner<br/>subagent]
    PP --> RES[gad-phase-researcher<br/>subagent]
    PLAN --> PLANMD[(PLAN.md)]

    LOOP --> IMPL[implement task]
    EX --> IMPL
    IMPL --> REG[(TASK-REGISTRY.xml)]
    IMPL --> ST[(STATE.xml)]
    IMPL --> DEC[(DECISIONS.xml)]

    REG --> V{verify}
    ST --> V
    V --> VRR[gad-verifier<br/>subagent]
    VR --> VRR
    VRR --> REPORT[(VERIFICATION.md)]

    REPORT --> COMMIT[git commit]
    COMMIT --> S

    class U user
    class S,CMD,LOOP,IMPL,COMMIT cmd
    class PP,EX,VR,PLAN,RES,VRR sub
    class PLANMD,REG,ST,DEC,REPORT state`;

export const HYPOTHESIS_TRACKS_DIAGRAM = `flowchart LR
    classDef freedom fill:#064e3b,stroke:#34d399,color:#d1fae5,stroke-width:2px
    classDef csh fill:#78350f,stroke:#fbbf24,color:#fef3c7,stroke-width:2px
    classDef gad fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe,stroke-width:2px
    classDef round fill:#1e1b4b,stroke:#818cf8,color:#e0e7ff,stroke-width:2px
    classDef finding fill:#3a1e2d,stroke:#c88d4c,color:#ffe4b5,stroke-width:2px

    R1[Round 1<br/>v1 reqs<br/>GAD only] --> R2[Round 2<br/>v2 reqs<br/>3 conditions]
    R2 --> R3[Round 3<br/>v3 gates<br/>3 conditions]
    R3 --> R4[Round 4<br/>v4 pressure<br/>3 conditions]
    R4 --> R5[Round 5<br/>v4 continued<br/>awaiting review]

    R1 -->|"GAD: 0.00<br/>blank screen"| F1[Finding:<br/>auto-scoring lies]
    R2 -->|"Bare 0.50 > GAD 0.30"| F2[Finding:<br/>bare beats GAD]
    R3 -->|"Bare 0.70 > Emer 0.50 > GAD 0.20"| F3["FREEDOM HYPOTHESIS<br/>less framework = better output"]
    R4 -->|"Emer 0.805 · skill ratchet"| F4["CSH CONFIRMED<br/>compound skills accumulate"]

    F1 --> |"added gates"| R2
    F2 --> |"added v3 gates"| R3
    F3 --> |"redesigned to v4 pressure"| R4
    F4 --> |"12 new v5 reqs from playtest"| R5

    class R1,R2,R3,R4,R5 round
    class F1 gad
    class F2 freedom
    class F3 freedom
    class F4 csh`;

export const EXPERIMENT_LOOP_DIAGRAM = `flowchart TD
    classDef design fill:#1e3a5f,stroke:#6f88a3,color:#e0b378,stroke-width:2px
    classDef run fill:#0f2e1a,stroke:#00c16a,color:#d9fbe8,stroke-width:2px
    classDef score fill:#3a1e2d,stroke:#c88d4c,color:#ffe4b5,stroke-width:2px
    classDef decide fill:#7c5f3b,stroke:#c88d4c,color:#fff,stroke-width:2px

    D["Design requirements<br/>(v1 → v2 → v3 → v4)"] --> C["Configure conditions<br/>GAD · Bare · Emergent"]
    C --> R["Run eval agents<br/>(serial, preserved)"]
    R --> S["Score: auto + human rubric"]
    S --> A{"Analyze findings"}
    A -->|"hypothesis supported"| N["Next round<br/>(harder requirements)"]
    A -->|"hypothesis refuted"| P["Redesign requirements<br/>(new approach)"]
    A -->|"inconclusive"| M["More runs<br/>(same conditions)"]
    N --> D
    P --> D
    M --> C

    class D,C design
    class R run
    class S score
    class A,N,P,M decide`;

export const WORKFLOW_EXAMPLE_CONVERSATION: WorkflowExampleTurn[] = [
  {
    speaker: "user",
    text: "let's plan the next phase — we need to ship the eval preservation contract",
  },
  {
    speaker: "agent",
    text:
      "Running `gad snapshot --projectid get-anything-done` to hydrate context before planning.",
  },
  {
    speaker: "tool",
    text:
      "Snapshot (sprint 4): phases 18→22 · current: 18 · next-action: plan phase 19 preservation contract · 38 decisions loaded",
  },
  {
    speaker: "agent",
    text:
      "I'll use the `/gad:plan-phase 19` skill. Spawning gad-phase-researcher first to survey prior eval runs that lost their artifacts.",
  },
  {
    speaker: "tool",
    text:
      "gad-phase-researcher → 3 runs lost artifacts in worktree cleanup · root cause: no preserve step · proposed contract in RESEARCH.md",
  },
  {
    speaker: "agent",
    text:
      "Good. Spawning gad-planner with the research attached. Goal-backward verification on: evals preserved at canonical paths, tests enforce, verify command audits.",
  },
  {
    speaker: "tool",
    text:
      "gad-planner → PLAN.md written · 6 tasks · goal-backward verification passes · committed as 19-01 through 19-06",
  },
  {
    speaker: "user",
    text: "yes go",
  },
  {
    speaker: "agent",
    text:
      "Switching to `/gad:execute-phase 19`. Task 19-01: implement `gad eval preserve` command. Wave 1.",
  },
  {
    speaker: "tool",
    text:
      "git commit 19-01: feat(eval): add preserve command · TASK-REGISTRY.xml updated · STATE.xml next-action → 19-02",
  },
];
