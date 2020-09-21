require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const { ApolloServer, gql } = require('apollo-server-express');
const neo4j = require('neo4j-driver');
const { makeAugmentedSchema } = require('neo4j-graphql-js');
const { typeDefs } = require('./graphql-schema');
const { resolvers } = require('./graphql-resolvers');

const app = express();

app.use(
  cookieSession({
    name: 'greenwood-network-test',
    maxAge: 24 * 60 * 60 * 1000,
    keys: [process.env.COOKIE_SESSION_KEY],
  })
);

app.get('/', (req, res) => {
  res.send(
    `
    root page, try /auth/google

    current User:
    ${JSON.stringify(req.user, null, 2)}
    `
  );
});

const schema = makeAugmentedSchema({
  typeDefs,
  resolvers,
  config: {
    query: {
      exclude: ['RatingCount'],
    },
    mutation: {
      exclude: ['RatingCount'],
    },
  },
});

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'neo4j'
  )
);

const initializeDatabase = async (driver) => {
  const initCypher = `CALL apoc.schema.assert({}, {User: ["userId"], Business: ["businessId"], Review: ["reviewId"], Series: ["seriesId"], Content: ["contentId"], Event: ["eventId"], Venue: ["venueId"], BusinessCategory: ["name"]})`;
  const ReviewableQuery = `CALL db.index.fulltext.createNodeIndex("Reviewable", ["Ownable"],["userId", "businessId", "reviewId", "seriesId", "contentId", "eventId", "venueId"])`;

  const session = driver.session();
  try {
    console.log('connecting to session');
    await driver.verifyConnectivity();
    await session.writeTransaction((tx) => tx.run(initCypher));
    await session.run(ReviewableQuery);
    console.log('Database initialized');
  } catch (error) {
    console.log('oops');
    console.error(
      'Database initialization failed to complete\n',
      error.message
    );
  } finally {
    session.close();
  }
};

const init = async (driver) => {
  await initializeDatabase(driver);
};

(async () => {
  const server = new ApolloServer({
    context: { driver, neo4jDatabase: process.env.NEO4J_DATABASE },
    schema: schema,
    introspection: true,
    playground: true,
  });

  const port = process.env.GRAPHQL_SERVER_PORT || 4001;
  const path = process.env.GRAPHQL_SERVER_PATH || '/graphql';
  const host = process.env.GRAPHQL_SERVER_HOST || '0.0.0.0';

  server.applyMiddleware({ app, path });

  await init(driver);

  app.listen({ host, port, path }, () =>
    console.log(
      `🚀 Server ready at http://${host}:${port}${server.graphqlPath}`
    )
  );
})();
