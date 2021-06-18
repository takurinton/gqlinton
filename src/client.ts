// ここがキーとなる（エントリポイント）になる
// 基本的には 
// operation を生成 → operation を実行 → 古くなったら破棄
// の流れ
// operation はキューで管理されている

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

    // replays には key と result が入る
    // active には key と source が入る(source は wonka)
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

        const source = pipe(
            result$, 
            // https://wonka.kitten.sh/api/operators#takeuntil
            // takeUntil: Take emissions from an outer source until an inner source (notifier) emits.
            // アクティブな teardown が送信されたら終了する
            takeUntil(
                pipe(
                  operations$,
                  filter(op => op.kind === 'teardown' && op.key === operation.key)
                )
            ),
            // https://wonka.kitten.sh/api/operators#switchmap
            // 外部ソースの値を内部ソースにマップする
            switchMap(result => {
                if (result.old) {
                    return fromValue(result);
                }
                return merge([
                    fromValue(result), 
                    pipe(
                        operations$,
                        // 条件が増えた
                        // 追加された条件に関しては以下参照
                        // https://dev.takurinton.com/tech/graphql/urql.html#urql-%E3%81%AE%E3%82%AD%E3%83%A3%E3%83%83%E3%82%B7%E3%83%A5
                        filter(op => {
                          return (
                            op.kind === operation.kind &&
                            op.key === operation.key &&
                            (op.context.requestPolicy === 'network-only' || op.context.requestPolicy === 'cache-and-network')
                          );
                        }),
                        take(1),
                        map(() => ({ ...result, old: true }))
                    ),
                ]);
            }), 
            onPush(result => {
                replays.set(operation.key, result);
            }),
            onStart(() => {
                active.set(operation.key, source);
            }),
            onEnd(() => {
                // アクティブな operation を削除する
                replays.delete(operation.key);
                active.delete(operation.key);
                // キューを削除する
                for (let i = queue.length - 1; i >= 0; i--)
                  if (queue[i].key === operation.key) queue.splice(i, 1);
                // 停止した teardown を dispatch する
                dispatchOperation(
                  makeOperation('teardown', operation, operation.context)
                );
            }),
            share,
        );
        return source;
    };

    // Clietn のインスタンスを作成
    // 上の interface で定義した Client の関数たちを使っていく
    // ここの実装が一番楽しいかもしれない
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

        // interface Client で実装した関数をひたすら実装していく
        reexecuteOperation(operation: Operation) {
            // mutation の時
            // または key があるとき（キャッシュがあるとき）
            if (operation.kind === 'mutation' || active.has(operation.key)) {
                queue.push(operation);
                if (!isOperationBatchActive) Promise.resolve().then(dispatchOperation);
            }
        }, 
        createOperationContext(opts) {
            if (!opts) opts = {};
            return {
                url: client.url,
                fetchOptions: client.fetchOptions,
                fetch: client.fetch,
                preferGetMethod: client.preferGetMethod,
                ...opts,
                suspense: opts.suspense || (opts.suspense !== false && client.suspense),
                requestPolicy: opts.requestPolicy || client.requestPolicy,
            };
        }, 
        createRequestOperation(kind, request, opts) {
            return makeOperation(kind, request, client.createOperationContext(opts));
        },
        executeRequestOperation(operation) {
            if (operation.kind === 'mutation') {
                return makeResultSource(operation);
            }

            const source = active.get(operation.key) || makeResultSource(operation);

            // キャッシュに関わらず、最終的には常にリクエストを投げる系のやつ
            const isNetworkOperation = operation.context.requestPolicy === 'cache-and-network' || operation.context.requestPolicy === 'network-only';

            // observer には next と complete がある
            return make(observer => {
                return pipe(
                    source, 
                    onStart(() => {
                        const prevReplay = replays.get(operation.key);
                        if (operation.kind === 'subscription') {
                            // キューを空にして return する
                            return dispatchOperation(operation);
                        } else if (isNetworkOperation) {
                            // キューを空にする
                            dispatchOperation(operation);
                        }

                        // replay に存在していたら古い operation
                        if (prevReplay != null && prevReplay === replays.get(operation.key)) {
                            observer.next(isNetworkOperation ? { ...prevReplay, old: true } : prevReplay);
                        } else if (!isNetworkOperation) {
                            dispatchOperation(operation);
                        }
                    }), 
                    onEnd(observer.complete),
                    subscribe(observer.next)
                ).unsubscribe;
            });
        }, 
        query(query, variables, context) {
        }, 
        readQuery(query, variables, context) {
        },
        executeQuery(query, opts) {
        }, 
        mutation(query, variables, context) {
        },
        executeMutation(query, opts) {
        },
        subscription(query, variables, context) {
        },
        executeSubscription(query, opts) {
        },

    } as Client);

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