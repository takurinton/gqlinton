import { filter, merge, mergeMap, pipe, share, takeUntil, onPush, make } from 'wonka';

import { Exchange } from '../types';
import {
  makeFetchBody,
  makeFetchURL,
  makeFetchOptions,
  makeFetchSource,
} from '../internal';

// https://formidable.com/open-source/urql/docs/architecture/#the-exchanges
// Sends an operation to the API using fetch and adds results to the output stream
// fetch を使用して API に operation 送信して、結果を output stream に追加する
export const fetchExchange: Exchange = ({ forward, dispatchDebug }) => {
    return ops$ => {
        const sharedOps$ = share(ops$);
        const fetchResults$ = pipe(
            sharedOps$, 
            filter(operation => {
                return operation.kind === 'query' || operation.kind === 'mutation';
            }), 
            mergeMap(operation => {
                const { key } = operation;
                const teardown$ = pipe(
                    sharedOps$, 
                    filter(op => op.kind === 'teardown' && op.key === key)
                );

                // ここで body, url, option を生成してる
                // internal がここで活きてきてる
                const body = makeFetchBody(operation);
                const url = makeFetchURL(operation, body);
                const fetchOptions = makeFetchOptions(operation, body);

                dispatchDebug({
                    type: 'fetchRequest', 
                    message: 'A fetch request is being executed.', 
                    operation, 
                    data: {
                        url, 
                        fetchOptions,
                    },
                });

                return pipe(
                    makeFetchSource(operation, url, fetchOptions),
                    takeUntil(teardown$),
                    onPush(result => {
                        const error = !result.data ? result.error : undefined;
            
                        dispatchDebug({
                        type: error ? 'fetchError' : 'fetchSuccess',
                        message: `A ${
                            error ? 'failed' : 'successful'
                        } fetch response has been returned.`,
                        operation,
                        data: {
                            url,
                            fetchOptions,
                            value: error || result,
                        },
                        });
                    })
                );
            })
        );
        
        const forward$ = pipe(
            sharedOps$,
            filter(operation => {
              return operation.kind !== 'query' && operation.kind !== 'mutation';
            }),
            forward
        );
      
        return merge([fetchResults$, forward$]);
    };
};