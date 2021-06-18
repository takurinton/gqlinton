import { createClient, gql } from 'gqlinton/dist';

const QUERY = gql`
query postQuery($pages: Int, $category: String){
  getPosts (page: $pages, category: $category){
    current
    next
    previous
    category
    results {
      id
      title
      contents
      category
      pub_date
    }
  }
}
`;

const client = createClient({
    url: 'https://api.takurinton.com/graphql',
});

client
.query(QUERY, { page: 1, category: '' })
.toPromise()
.then(res => console.log(res));