export interface ApiError {
  code: string;
  message: string;
}

export interface ApiMeta {
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  data: T | null;
  errors: ApiError[] | null;
  meta: ApiMeta | null;
}
