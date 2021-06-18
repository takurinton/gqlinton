import {
    DocumentNode,
    FieldNode,
    InlineFragmentNode,
    SelectionNode,
    Kind,
    visit,
} from 'graphql';
  
import { KeyedDocumentNode, keyDocument } from './request';

interface EntityLike {
    [key: string]: EntityLike | EntityLike[] | any;
    __typename: string | null | void;
}

const collectTypes = (
    obj: EntityLike | EntityLike[], 
    types: { [typename: string]: unknown }
) => {
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) collectTypes(obj[i], types);
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (key === '__typename' && typeof obj[key] === 'string') {
            types[obj[key] as string] = 0;
          } else {
            collectTypes(obj[key], types);
          }
        }
    }

    return types;
};

export const collectTypesFromResponse = (res: object) => Object.keys(collectTypes(res as EntityLike, {}));

const fmtNode = (node: FieldNode | InlineFragmentNode) => {
    // ここよくわかってない
    // key 見てなんとなく判断してるけどあまり理解してない
    if (
        node.selectionSet &&
        !node.selectionSet.selections.some(
          node =>
            node.kind === Kind.FIELD &&
            node.name.value === '__typename' &&
            !node.alias
        )
    ) {
        return {
            ...node,
            selectionSet: {
                ...node.selectionSet,
                selections: [
                ...(node.selectionSet.selections as SelectionNode[]),
                {
                    kind: Kind.FIELD,
                    name: {
                    kind: Kind.NAME,
                    value: '__typename',
                    },
                },
                ],
            },
        };
    };
};

const formattedDocs = new Map<number, KeyedDocumentNode>();

export const fmtDoc = <T extends DocumentNode>(node: T): T => {
    const query = keyDocument(node);
    let result = formattedDocs.get(query.__key);
    if (!result) {
        result = visit(query, {
            Field: fmtNode, 
            InlineFragment: fmtNode, 
        }) as KeyedDocumentNode;
        // 結果のハッシュが突然変更されないことを確認する
        result.__key = query.__key;
        formattedDocs.set(query.__key, result);
    }
    return (result as unknown) as T; // よくわからない
}