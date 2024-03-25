import { InStatement, ResultSet, Row } from "@libsql/client/web";
import {
  BaseDriver,
  DatabaseSchemaItem,
  DatabaseTableOperation,
  DatabaseTableOperationReslt,
  DatabaseTableSchema,
  SelectFromTableOptions,
} from "./base-driver";
import {
  ApiOpsBatchResponse,
  ApiOpsQueryResponse,
  ApiSchemaListResponse,
  ApiSchemaResponse,
} from "@/lib/api-response-types";
import { RequestOperationBody } from "@/lib/api/api-request-types";

export function transformRawResult(raw: ResultSet): ResultSet {
  const r = {
    ...raw,
    rows: raw.rows.map((r) =>
      raw.columns.reduce((a, b, idx) => {
        a[b] = r[idx];
        return a;
      }, {} as Row)
    ),
  };

  return r;
}

export default class RemoteDriver implements BaseDriver {
  protected id: string = "";
  protected authToken = "";
  protected name = "";

  constructor(id: string, authToken: string, name: string) {
    this.id = id;
    this.authToken = authToken;
    this.name = name;
  }

  getEndpoint() {
    return this.name;
  }

  protected async request<T = unknown>(body: RequestOperationBody) {
    const r = await fetch(`/api/ops/${this.id}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.authToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = await r.json();
    if (json?.error) throw new Error(json.error);

    return json as T;
  }

  async query(stmt: InStatement) {
    const r = await this.request<ApiOpsQueryResponse>({
      type: "query",
      statement: stmt,
    });

    return transformRawResult(r.data);
  }

  async transaction(stmt: InStatement[]) {
    const r = await this.request<ApiOpsBatchResponse>({
      type: "batch",
      statements: stmt,
    });

    return r.data.map(transformRawResult);
  }

  close() {}

  async schemas(): Promise<DatabaseSchemaItem[]> {
    return (await this.request<ApiSchemaListResponse>({ type: "schemas" }))
      .data;
  }

  async tableSchema(tableName: string): Promise<DatabaseTableSchema> {
    return (
      await this.request<ApiSchemaResponse>({ type: "schema", tableName })
    ).data;
  }

  async updateTableData(
    tableName: string,
    ops: DatabaseTableOperation[]
  ): Promise<DatabaseTableOperationReslt[]> {
    return await this.request({
      type: "update-table-data",
      ops,
      tableName,
    });
  }

  async selectTable(
    tableName: string,
    options: SelectFromTableOptions
  ): Promise<{ data: ResultSet; schema: DatabaseTableSchema }> {
    return await this.request({
      type: "select-table",
      tableName,
      limit: options.limit,
      offset: options.offset,
      whereRaw: options.whereRaw,
    });
  }
}