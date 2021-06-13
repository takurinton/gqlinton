import { TypedDocumentNode } from '@graphql-typed-document-node/core';

import {
    Location,
    DefinitionNode,
    DocumentNode,
    Kind,
    parse,
    print,
} from 'graphql';

import { hash, phash } from './hash';
import { stringify } from './stringify';
import { GraphQLRequest } from '../types';

interface WritableLocation {
    loc: Location | undefined;
};

export interface KeyedDocumentNode extends DocumentNode {
    __key: number;
};

export const Doc2String = (
    node: string | DefinitionNode | DocumentNode
): string => {
    let str = (typeof node !== 'string' ? (node.loc && node.loc.source.body) || print(node) : node)
    .replace(/([\s,]|#[^\n\r]+)+/g, ' ')
    .trim();

    if (typeof node !== 'string') {
        const operationName = 'definitions' in node && getOperationName(node);
        if (operationName) {
            str = `# ${operationName}\n${str}`;
        }
        if (!node.loc) {
            (node as WritableLocation).loc = {
              start: 0,
              end: str.length,
              source: {
                body: str,
                name: 'gql',
                locationOffset: { line: 1, column: 1 },
              },
            } as Location;
        };
    };

    return str;
}

const docs = new Map<number, KeyedDocumentNode>();

export const keyDocument = (q: string | DocumentNode): KeyedDocumentNode => {
    let key: number;
    let query: DocumentNode;
    if (typeof q === 'string') {
      // ここで使うhash
      key = hash(Doc2String(q));
      query = docs.get(key) || parse(q, { noLocation: true });
    } else {
      key = (q as KeyedDocumentNode).__key || hash(Doc2String(q));
      query = docs.get(key) || q;
    }
  
    if (!query.loc) Doc2String(query);
  
    (query as KeyedDocumentNode).__key = key;
    docs.set(key, query as KeyedDocumentNode);
    return query as KeyedDocumentNode;
};
  
// クエリと引数を用いてリクエストを作成する
// よく見るやつだ
export const createRequest = <Data = any, Variables = object>(
    q: string | DocumentNode | TypedDocumentNode<Data, Variables>,
    variables?: Variables
): GraphQLRequest<Data, Variables> => {
    if (!variables) variables = {} as Variables;
    const query = keyDocument(q);
    return {
        // weak map をクリアしない
        key: phash(query.__key, stringify(variables)) >>> 0,
        query,
        variables: variables,
    };
};
  

export const getOperationName = (query: DocumentNode): string | undefined => {
    for (let i = 0, l = query.definitions.length; i < l; i++) {
      const node = query.definitions[i];
      if (node.kind === Kind.OPERATION_DEFINITION && node.name) {
        return node.name.value;
      }
    }
};