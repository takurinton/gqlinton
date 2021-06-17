import {
    filter,
    make,
    makeSubject,
    onEnd,
    onPush,
    onStart,
    pipe,
    share,
    Source,
    take,
    takeUntil,
    publish,
    subscribe,
    switchMap,
    fromValue,
    merge,
    map,
    Subscription,
} from 'wonka';

import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { DocumentNode } from 'graphql';

import { composeExchanges, defaultExchanges } from './exchanges';
import { fallbackExchange } from './exchanges/fallback';

import {
    Exchange,
    ExchangeInput,
    GraphQLRequest,
    Operation,
    OperationContext,
    OperationResult,
    OperationType,
    RequestPolicy,
    PromisifiedSource,
    DebugEvent,
} from './types';

import {
    createRequest,
    stream,
    typenameWrap,
    noop,
    makeOperation, 
} from './utils';

// OperationContext と近い
export interface Options {
    url: string;
    fetchOptions?: RequestInit | (() => RequestInit);
    fetch?: typeof fetch;
    exchanges?: Exchange[];
    suspense?: boolean;
    requestPolicy?: RequestPolicy;
    preferGetMethod?: boolean;
    maskTypename?: boolean;
}

export interface Client {
    new (options: Options): Client;
    operations$: Source<Operation>; // operation の定義

    reexecuteOperation: (operation: Operation) => void; // operation の再実行
    subscribeToDebugTarget?: (onEvent: (e: DebugEvent) => void) => Subscription; // event target をモニタリングする

    // 上で定義してる Options から生成された変数
    url: string;
    fetch?: typeof fetch;
    fetchOptions?: RequestInit | (() => RequestInit);
    suspense: boolean;
    requestPolicy: RequestPolicy;
    preferGetMethod: boolean;
    maskTypename: boolean;

    // operation の定義
    createOperationContext(
        opts?: Partial<OperationContext> | undefined    
    ): OperationContext;    

    createRequestOperation<Data = any, Variables = object>(
        kind: OperationType,
        request: GraphQLRequest<Data, Variables>,
        opts?: Partial<OperationContext> | undefined
    ): Operation<Data, Variables>;

    executeRequestOperation<Data = any, Variables = object>(
        operation: Operation<Data, Variables>
    ): Source<OperationResult<Data, Variables>>;

    // 読み込みは query, variables, context が必要
    // 実行には query と options が必要

    // query の定義
    // query のみ、読み込む作業と実行する作業がある（それはそう）
    query<Data = any, Variables extends object = {}>(
        query: DocumentNode | TypedDocumentNode<Data, Variables> | string,
        variables?: Variables,
        context?: Partial<OperationContext>
    ): PromisifiedSource<OperationResult<Data, Variables>>;

    readQuery<Data = any, Variables extends object = {}>(
        query: DocumentNode | TypedDocumentNode<Data, Variables> | string,
        variables?: Variables,
        context?: Partial<OperationContext>
    ): OperationResult<Data, Variables> | null;

    executeQuery<Data = any, Variables = object>(
        query: GraphQLRequest<Data, Variables>,
        opts?: Partial<OperationContext> | undefined
    ): Source<OperationResult<Data, Variables>>;

    // mutation の定義
    mutation<Data = any, Variables extends object = {}>(
        query: DocumentNode | TypedDocumentNode<Data, Variables> | string,
        variables?: Variables,
        context?: Partial<OperationContext>
    ): PromisifiedSource<OperationResult<Data, Variables>>;

    executeMutation<Data = any, Variables = object>(
        query: GraphQLRequest<Data, Variables>,
        opts?: Partial<OperationContext> | undefined
    ): Source<OperationResult<Data, Variables>>;

    // subscription の定義
    subscription<Data = any, Variables extends object = {}>(
        query: DocumentNode | TypedDocumentNode<Data, Variables> | string,
        variables?: Variables,
        context?: Partial<OperationContext>
    ): Source<OperationResult<Data, Variables>>;

    executeSubscription<Data = any, Variables = object>(
        query: GraphQLRequest<Data, Variables>,
        opts?: Partial<OperationContext> | undefined
    ): Source<OperationResult<Data, Variables>>;
};