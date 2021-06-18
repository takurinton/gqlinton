import { filter, map, merge, pipe, share, tap } from 'wonka';

import { Client } from '../client';
import { Exchange, Operation, OperationResult } from '../types';

import {
  makeOperation,
  addMetadata,
  collectTypesFromResponse,
  fmtDoc,
} from '../utils';

type ResultCache = Map<number, OperationResult>;

interface OperationCache {
  [key: string]: Set<number>;
}

const shouldSkip = ({ kind }: Operation) => kind !== 'mutation' && kind !== 'query';

// https://formidable.com/open-source/urql/docs/architecture/#the-exchanges
// The default caching logic with "Document Caching"
// デフォルトのキャッシュロジックを実装してる、ドキュメントキャッシングという仕組み
// キャッシュがあればそいつを返す、なければリクエストを投げる
export const cacheExchange: Exchange = ({ forward, client, dispatchDebug }) => {
    const resultCache = new Map() as ResultCache;
    const operationCache = Object.create(null) as OperationCache;

    const mapTypeNames = (operation: Operation): Operation => {
                                // makeOperation(kind, request, context)
        const formattedOpeeation = makeOperation(operation.kind, operation);
        formattedOpeeation.query = fmtDoc(operation.query);
        return formattedOpeeation;
    }

    const isOperationCached = (operation: Operation) => {
        const { key, kind, context: { requestPolicy } } = operation;
        return (
            kind === 'query' && requestPolicy !== 'network-only' && (requestPolicy === 'cache-only' || resultCache.has(key))
        );
    };

    return ops$ => {
        const sharedOps$ = share(ops$);
        const cachedOps$ = pipe(
            sharedOps$, 
            filter(op => !shouldSkip(op) && isOperationCached(op)), 
            map(operation => {
                // Map 
                const cacheResult = resultCache.get(operation.key);
                dispatchDebug({
                    operation, 
                    ...(cacheResult ? {
                        type: 'cacheHit', 
                        message: 'The result was successfully retried from the cache'
                    } : {
                        type: 'cacheMiss', 
                        message: 'The result could not be retrieved from the cache'
                    })
                });

                const result: OperationResult = {
                    ...cacheResult, 
                    operation: addMetadata(operation, {
                        cacheOutcome: cacheResult ? 'hit' : 'miss', 
                    }), 
                };

                if (operation.context.requestPolicy === 'cache-and-network') {
                    result.old = true;
                    reexecuteOperation(client, operation);
                };

                return result;
            })
        );

        const forwardedOps$ = pipe(
            merge([
                pipe(
                  sharedOps$,
                  filter(op => !shouldSkip(op) && !isOperationCached(op)),
                  map(mapTypeNames)
                ),
                pipe(
                  sharedOps$,
                  filter(op => shouldSkip(op))
                ),
            ]), 
            map(op => addMetadata(op, { cacheOutcome: 'miss' })),
            filter(
                op => op.kind !== 'query' || op.context.requestPolicy !== 'cache-only'
            ),
            forward,
            tap(res => {
                let { operation } = res;
                if (!operation) return;

                const typenames = collectTypesFromResponse(res.data).concat(operation.context.additionalTypenames || []);
                
            })
        )

        return merge([cachedOps$, forwardedOps$]);
    };
};

const reexecuteOperation = (client: Client, operation: Operation) => {
    return client.reexecuteOperation(
      makeOperation(operation.kind, operation, {
        ...operation.context,
        requestPolicy: 'network-only',
      })
    );
  };
  