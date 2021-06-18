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

export const Client: new (opts: Options) => Client = function Client(
    this: Client | {},
    opts: Options
) {
    if (process.env.NODE_ENV !== 'production' && !opts.url) {
        throw new Error('You are creating an client without a url.');
    }

    const replays = new Map<number, OperationResult>();
    const active: Map<number, Source<OperationResult>> = new Map();
    const queue: Operation[] = []; // operation が入ってる、下で dispatcher を定義していて、そこで操作を行う、操作の操作、、なんつって

    // operation を入れる, subject に新しい operation を dispatch するたびに呼ばれる
    // makeSubject は wonka 
    const { 
        source: operations$, 
        next: nextOperation 
    } = makeSubject<Operation>();

    // キューの dispatcher を定義する、キューを空にすることができる
    let isOperationBatchActive = false;
    const dispatchOperation = (operation?: Operation | void) => {
        isOperationBatchActive = true;
        if (operation) nextOperation(operation);
        // queue なので shift https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Array/shift
        while ((operation = queue.shift())) nextOperation(operation);
        isOperationBatchActive = false;
    }

    // result の stream の生成
    const makeResultSource = (operation: Operation) => {
        let result$ = pipe(
            results$, 
            filter(
                (res: OperationResult) => res.operation.kind === operation.kind && res.operation.key === operation.key
            )
        );

        // option が on になってる場合は typename を返す
        if (client.maskTypename) {
                result$ = pipe(
                result$, 
                map(res => ({ ...res, data: typenameWrap(res.data) }))
            )
        }

        // mutation は新しいキャッシュを生成するため、常に一意になる
        if (operation.kind === 'mutation') {
            return pipe(
              result$,
              onStart(() => dispatchOperation(operation)),
              take(1)
            );
        }
    };

    // Clietn のインスタンスを作成
    // 上の interface で定義した Client の関数たちを使っていく
    const instance: Client = this instanceof Client ? this : Object.create(Client.prototype);
    // Object.assign
    // 第一引数のオブジェクトに第二引数のオブジェクトを移す（第一引数のオブジェクトは保持されるけど競合を起こしてたら第二引数の値が優先される
    // 戻り値と第一引数の値は等しくなる (ここで言うと client === instance は true)
    // 第二引数は変更されない
    // https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
    const client: Client = Object.assign(instance, {
        url: opts.url,
        fetchOptions: opts.fetchOptions,
        fetch: opts.fetch,
        suspense: !!opts.suspense,
        requestPolicy: opts.requestPolicy || 'cache-first',
        preferGetMethod: !!opts.preferGetMethod,
        maskTypename: !!opts.maskTypename,
        operations$, 

    })

    // デバッグ用の dispatch 
    let dispatchDebug: ExchangeInput['dispatchDebug'] = noop;
    if (process.env.NODE_ENV !== 'production') {
        const { next, source } = makeSubject<DebugEvent>();
        client.subscribeToDebugTarget = (onEvent: (e: DebugEvent) => void) =>
        pipe(source, subscribe(onEvent));
        dispatchDebug = next as ExchangeInput['dispatchDebug'];
    }

    const exchanges = opts.exchanges !== undefined ? opts.exchanges : defaultExchanges;

    // 全ての Exchange は単一
    const composedExchange = composeExchanges(exchanges);

    // stream の io(全ての exchange は ExchangeIO を介して実行される)
    // results$ の stream を受け取って client にアクセスするか、dispatch する
    const results$ = share(
        composedExchange({
          client,
          dispatchDebug,
          forward: fallbackExchange({ dispatchDebug }),
        })(operations$)
      );
    
} as any;

export const createClient = (Client as any) as (opts: Options) => Client;