import { DocumentNode, print } from 'graphql';

import { getOperationName, stringify } from '../utils';
import { Operation } from '../types';
import { url } from 'inspector';

// よく見るやつ
// ここがよく見るクライアントの部分
export interface FetchBody {
  query?: string;
  operationName: string | undefined;
  variables: undefined | Record<string, any>;
  extensions: undefined | Record<string, any>;
}

const shouldUseGet = (operation: Operation): boolean => {
    return operation.kind === 'query' && !!operation.context.preferGetMethod;
}

// これもよく見るやつ
export const makeFetchBody = (request: {
    query: DocumentNode;
    variables?: object;
}): FetchBody => ({
    query: print(request.query), 
    operationName: getOperationName(request.query), 
    variables: request.variables || undefined, 
    extensions: undefined,
});

// URL の作成
export const makeFetchURL = (
    operation: Operation, 
    body?: FetchBody,
): string => {
    const useGETMethod = shouldUseGet(operation);
    const url = operation.context.url;
    if (!useGETMethod) return url;

    const search: string[] = [];

    // それぞれの形によって変える
    if (body.operationName) search.push('operationName=' + encodeURIComponent(body.operationName));
    if (body.query) {
        search.push(
          'query=' +
            encodeURIComponent(
              body.query.replace(/([\s,]|#[^\n\r]+)+/g, ' ').trim()
            )
        );
    }
    if (body.variables) {
        search.push(
            'variables=' + encodeURIComponent(stringify(body.variables))
        );
    }
    if (body.extensions) {
        search.push(
            'extensions=' + encodeURIComponent(stringify(body.extensions))
        );
    }

    return `${url}?${search.join('&')}`;
}

export const makeFetchOptions = (
    operation: Operation,
    body?: FetchBody
  ): RequestInit => {
    const useGETMethod = shouldUseGet(operation);
    const extraOptions = typeof operation.context.fetchOptions === 'function' ? operation.context.fetchOptions() : operation.context.fetchOptions || {};
  
    return {
      ...extraOptions,
      body: !useGETMethod && body ? JSON.stringify(body) : undefined,
      method: useGETMethod ? 'GET' : 'POST', // どっちでもいける、これが個人的GraphQLいちばんの衝撃（？）
      headers: useGETMethod
        ? extraOptions.headers
        : { 'content-type': 'application/json', ...extraOptions.headers },
    };
  };
  