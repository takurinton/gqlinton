import { Operation, OperationResult } from '../types';
import { makeOkResult, makeErrorResult } from '../utils';
import { make } from 'wonka';

// RequestInit 
// https://microsoft.github.io/PowerBI-JavaScript/interfaces/_node_modules_typedoc_node_modules_typescript_lib_lib_dom_d_.requestinit.html

const executeFetch = (
    operation: Operation,
    url: string,
    options: RequestInit,
): Promise<OperationResult> => {
    const fetcter = operation.context.fetch;
    let statusNotOk = false;
    let response: Response;

    return (fetcter || fetch)(url, options)
    .then((res: Response) => {
        response = res;
        statusNotOk = res.status < 200 || res.status >= (options.redirect === 'manual' ? 400 : 300);
        return res.json();
    })
    .then((result: any) => {
        // 正しい形じゃなかったら
        if (!('data' in result) && !('error' in result)) {
            throw new Error('No Content!!');
        }
        return makeOkResult(operation, result, response);
    })
    .catch((error: Error) => {
        if (error.name !== 'AbortError') {
          return makeErrorResult(
            operation,
            statusNotOk ? new Error(response.statusText) : error,
            response
          );
        }
    }) as Promise<OperationResult>;
}

export const makeFetchSource = (
    operation: Operation, 
    url: string, 
    options: RequestInit,
) => {
    return make<OperationResult>(({ next, complete }) => {
        // https://developer.mozilla.org/en-US/docs/Web/API/AbortController
        // 任意のリクエストを中止することができる
        const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;

        let ended = false;
        Promise.resolve()
        .then(() => {
            if (ended) return 
            else if (abortController) options.signal = abortController.signal;

            return executeFetch(operation, url, options);
        })
        .then((result: OperationResult | undefined) => {
            if (!ended) {
                ended = true;
                if (result) next(result);
                complete();
            };
        });

        return () => {
            ended = true;
            if (abortController) abortController.abort();
        };
    });
};