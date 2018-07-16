let typeDefinitions = `

type PageInfo {
    endCursor: String
    hasNextPage: Boolean
}

type ExecutionEdge {
    node: TaskExecution
    cursor: String
}

type ExecutionConnection {
    totalCount: Int
    pageInfo: PageInfo
    edges: [ExecutionEdge]
}

type ExecutionPage {
    offset: Int
    limit: Int
    totalCount: Int
    hasNextPage: Boolean
    items: [TaskExecution]
}

type TaskDefinition {
  id: String!
  name: String!
  description: String!
  script: String!
  interpreter: String!
  script_args: String
  cluster_args: String
  local_work_units: Float
  cluster_work_units: Float
  log_prefix: String
  created_at: Float
  updated_at: Float
  deleted_at: Float
}

type TaskExecution {
  id: String!
  worker_id: String
  remote_task_execution_id: String
  tile_id: String
  task_definition_id: String
  task: TaskDefinition
  pipeline_stage_id: String
  queue_type: Int
  local_work_units: Float
  cluster_work_units: Float
  resolved_output_path: String
  resolved_script: String
  resolved_interpreter: String
  resolved_script_args: String
  resolved_cluster_args: String
  resolved_log_path: String
  expected_exit_code: Int
  job_id: Int
  job_name: String
  execution_status_code: Int
  completion_status_code: Int
  last_process_status_code: Int
  cpu_time_seconds: Float
  max_cpu_percent: Float
  max_memory_mb: Float
  exit_code: Int
  submitted_at: Float
  started_at: Float
  completed_at: Float
  sync_status: Int
  synchronized_at: Float
  created_at: Float
  updated_at: Float
  deleted_at: Float
}

type Worker {
  id: String
  process_id: Int
  preferred_network_interface_id: String
  display_name: String
  local_work_capacity: Float
  cluster_work_capacity: Float
  is_accepting_jobs: Boolean
  local_task_load: Float
  cluster_task_load: Float
  created_at: String
  updated_at: String
  deleted_at: String
}

type StartTaskResponse {
    taskExecution: TaskExecution
    localTaskLoad: Float
    clusterTaskLoad: Float
}

input WorkerInput {
  id: String
  preferred_network_interface_id: String
  display_name: String
  local_work_capacity: Float
  cluster_work_capacity: Float
  is_accepting_jobs: Boolean
}

type Query {
  taskDefinitions: [TaskDefinition!]!
  taskDefinition(id: String!): TaskDefinition
  taskExecution(id: String!): TaskExecution
  taskExecutions: [TaskExecution!]!
  taskExecutionPage(offset: Int, limit: Int): ExecutionPage
  taskExecutionConnections(first: Int, after: String): ExecutionConnection
  runningTasks: [TaskExecution!]!
  worker: Worker
}

type Mutation {
  updateWorker(worker: WorkerInput): Worker

  startTask(taskInput: String!): StartTaskResponse
  stopTask(taskExecutionId: String!): TaskExecution

  removeCompletedExecutionsWithCode(code: Int): Int
}

schema {
  query: Query
  mutation: Mutation
}
`;

export default typeDefinitions;
