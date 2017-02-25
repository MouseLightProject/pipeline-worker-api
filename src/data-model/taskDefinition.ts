import {ITableModelRow, TableModel} from "./tableModel";

export interface ITaskDefinitionInput {
    id: string;
    name: string;
    description: string;
    script: string;
    interpreter: string;
    args: string;
    work_units: number;
}

export interface ITaskDefinition extends ITableModelRow {
    name: string;
    description: string;
    script: string;
    interpreter: string;
    args: string;
    work_units: number;
}

export class TaskDefinitions extends TableModel<ITaskDefinition> {
    public constructor() {
        super("TaskDefinition");
    }

    public async updateFromInput(taskDefinition: ITaskDefinitionInput): Promise<ITaskDefinition> {
        if (!taskDefinition.id || taskDefinition.id.length === 0) {
            return null;
        }

        let row = await this.get(taskDefinition.id);

        if (!row) {
            return null;
        }

        row.name = taskDefinition.name || row.name;
        row.description = taskDefinition.description || row.description;
        row.script = taskDefinition.script || row.script;
        row.interpreter = taskDefinition.interpreter || taskDefinition.interpreter;
        row.args = taskDefinition.args || taskDefinition.args;
        row.work_units = taskDefinition.work_units || taskDefinition.work_units;

        return await this.save(row);
    }
}
