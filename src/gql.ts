// タグテンプレートとして使う
// ここら辺の実装は自作 lit でも使えそうなのでしっかり読みたい

import { TypedDocumentNode } from '@graphql-typed-document-node/core';

import {
  DocumentNode,
  DefinitionNode,
  FragmentDefinitionNode,
  Kind,
} from 'graphql';

import { keyDocument, Doc2String } from './utils';

const applyDefinitions = (
    fragments: Map<string, string>,
    target: DefinitionNode[], 
    source: Array<DefinitionNode> | ReadonlyArray<DefinitionNode>
) => {
    for (let i = 0; i < source.length; i++) {
        if (source[i].kind === Kind.FRAGMENT_DEFINITION) {
            const name = (source[i] as FragmentDefinitionNode).name.value;
            const value = Doc2String(source[i]);
            if (!fragments.has(name)) {
                fragments.set(name, value);
                target.push(source[i]);
            } else if (fragments.get(name) !== value) {
                console.log('warning: already exists in this document.');
            };
        } else {
            target.push(source[i]);
        }
    }
}

function gql<Data = any, Variables = object>(
    strings: TemplateStringsArray,
    ...interpolations: Array<TypedDocumentNode | DocumentNode | string>
): TypedDocumentNode<Data, Variables>;
  
function gql<Data = any, Variables = object>(
    string: string
): TypedDocumentNode<Data, Variables>;

function gql(/* arguments */) {
    const fragmentNames = new Map<string, string>();
    const definitions: DefinitionNode[] = [];
    const interpolations: DefinitionNode[] = [];
  
    // タグテンプレートの全体
    let body: string = Array.isArray(arguments[0]) ? arguments[0][0]: arguments[0] || '';
    for (let i = 1; i < arguments.length; i++) {
      const value = arguments[i];
      if (value && value.definitions) {
        interpolations.push(...value.definitions);
      } else {
        body += value;
      }
  
      body += arguments[0][i];
    }
  
    // タグの本体
    applyDefinitions(fragmentNames, definitions, keyDocument(body).definitions);
    // 補完された各ドキュメントのコピー
    applyDefinitions(fragmentNames, definitions, interpolations);
  
    return keyDocument({
      kind: Kind.DOCUMENT,
      definitions,
    });
}
  
export { gql };