import { GraphQLError } from 'graphql';

// エラーを定義する
const makeErrorMessage = (
  networkErr?: Error,
  graphQlErrs?: GraphQLError[]
) => {
  let error = '';
  if (networkErr !== undefined) {
    return (error = `[Network] ${networkErr.message}`);
  }

  if (graphQlErrs !== undefined) {
    graphQlErrs.forEach(err => {
      error += `[GraphQL] ${err.message}\n`;
    });
  }

  return error.trim();
};

const rehydrateGraphQLError = (error: any): GraphQLError => {
  if (typeof error === 'string') return new GraphQLError(error);
  else if (typeof error === 'object' && error.message) {
      return new GraphQLError(
          error.message,
          error.nodes,
          error.source,
          error.positions,
          error.path,
          error,
          error.extensions || {}
          );
  } else {
      return error as any;
  };
};

export class CombinedError extends Error {
  public name: string;
  public message: string;
  public graphQLErrors: GraphQLError[];
  public networkError?: Error;
  public response?: any;
  
  constructor({
      networkError,
      graphQLErrors,
      response,
  }: {
      networkError?: Error;
      graphQLErrors?: Array<string | Partial<GraphQLError> | Error>;
      response?: any;
  }) {
      const normalizedGraphQLErrors = (graphQLErrors || []).map(rehydrateGraphQLError);
      const message = makeErrorMessage(networkError, normalizedGraphQLErrors);
  
      super(message);
  
      this.name = 'CombinedError';
      this.message = message;
      this.graphQLErrors = normalizedGraphQLErrors;
      this.networkError = networkError;
      this.response = response;
  }
  
  toString() {
      return this.message;
  }
}