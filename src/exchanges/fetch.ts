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


                // body 
                // {query: "query postQuery($id: Int) {\n  getPost(id: $id) {\n …e\n    contents\n    pub_date\n    __typename\n  }\n}\n", operationName: "postQuery", variables: {…}, extensions: undefined}
                // extensions: undefined
                // operationName: "postQuery"
                // query: "query postQuery($id: Int) {\n  getPost(id: $id) {\n    id\n    title\n    contents\n    pub_date\n    __typename\n  }\n}\n"
                // variables: {id: 50}
                // __proto__: Object

                // url
                // localhost:8080/graphql
                // endpoint

                // fetchOptions
                // {body: "{\"query\":\"query postQuery($id: Int) {\\n  getPost(i…operationName\":\"postQuery\",\"variables\":{\"id\":50}}", method: "POST", headers: {…}}
                // body: "{\"query\":\"query postQuery($id: Int) {\\n  getPost(id: $id) {\\n    id\\n    title\\n    contents\\n    pub_date\\n    __typename\\n  }\\n}\\n\",\"operationName\":\"postQuery\",\"variables\":{\"id\":50}}"
                // headers: {content-type: "application/json"}
                // method: "POST"
                // signal: AbortSignal {aborted: true, onabort: null}
                // __proto__: Object

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