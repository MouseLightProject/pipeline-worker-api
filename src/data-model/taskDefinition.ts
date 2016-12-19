import {ITableModelRow, TableModel} from "./tableModel";

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
}
