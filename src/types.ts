import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { DocumentNode } from 'graphql';
import { Source } from 'wonka';
// import { Client } from './client'; あとで追加
import { CombinedError } from './utils/error';

export { ExecutionResult } from 'graphql';

export type PromisifiedSource<T = any> = Source<T> & {
  toPromise: () => Promise<T>;
};

export type OperationType = 'subscription' | 'query' | 'mutation' | 'teardown';

export type RequestPolicy =
  | 'cache-first'
  | 'cache-only'
  | 'network-only'
  | 'cache-and-network';

export type CacheOutcome = 'miss' | 'partial' | 'hit';

export interface GraphQLRequest<Data = any, Variables = object> {
  key: number;
  query: DocumentNode | TypedDocumentNode<Data, Variables>;
  variables?: Variables;
}

export interface OperationDebugMeta {
  source?: string;
  cacheOutcome?: CacheOutcome;
  networkLatency?: number;
  startTime?: number;
}

export interface OperationContext {
  [key: string]: any;
  additionalTypenames?: string[];
  fetch?: typeof fetch;
  fetchOptions?: RequestInit | (() => RequestInit);
  requestPolicy: RequestPolicy;
  url: string;
  meta?: OperationDebugMeta;
  suspense?: boolean;
  preferGetMethod?: boolean;
}

export interface Operation<Data = any, Variables = any>
  extends GraphQLRequest<Data, Variables> {
  readonly kind: OperationType;
  context: OperationContext;
}

/** Resulting data from an [operation]{@link Operation}. */
export interface OperationResult<Data = any, Variables = any> {
  operation: Operation<Data, Variables>;
  data?: Data;
  error?: CombinedError;
  extensions?: Record<string, any>;
  stale?: boolean;
}

export interface ExchangeInput {
  client: any; // ほんとは Client がくる。
  forward: ExchangeIO;
  dispatchDebug: <T extends keyof DebugEventTypes | string>(
    t: DebugEventArg<T>
  ) => void;
}

export type Exchange = (input: ExchangeInput) => ExchangeIO;

export type ExchangeIO = (ops$: Source<Operation>) => Source<OperationResult>;

export interface DebugEventTypes {
  // Cache exchange
  cacheHit: { value: any };
  cacheInvalidation: {
    typenames: string[];
    response: OperationResult;
  };
  // Fetch exchange
  fetchRequest: {
    url: string;
    fetchOptions: RequestInit;
  };
  fetchSuccess: {
    url: string;
    fetchOptions: RequestInit;
    value: object;
  };
  fetchError: {
    url: string;
    fetchOptions: RequestInit;
    value: Error;
  };
  // Retry exchange
  retryRetrying: {
    retryCount: number;
  };
}

export type DebugEventArg<T extends keyof DebugEventTypes | string> = {
  type: T;
  message: string;
  operation: Operation;
} & (T extends keyof DebugEventTypes
  ? { data: DebugEventTypes[T] }
  : { data?: any });

export type DebugEvent<
  T extends keyof DebugEventTypes | string = string
> = DebugEventArg<T> & {
  timestamp: number;
  source: string;
};