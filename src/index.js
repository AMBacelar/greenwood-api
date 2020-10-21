require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const { ApolloServer, gql } = require('apollo-server-express');
const neo4j = require('neo4j-driver');
const { makeAugmentedSchema } = require('neo4j-graphql-js');
const { typeDefs } = require('./graphql-schema');
const { resolvers } = require('./graphql-resolvers');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

const allowedOrigins = JSON.parse(process.env.ALLOWED_ORIGINS);

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin
      // (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        const msg = `The CORS policy for this site does not allow access from the specified Origin.`;
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(cookieParser());

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

  try {
    await driver.verifyConnectivity();
    console.log('Driver created');
  } catch (error) {
    console.log(`connectivity verification failed. ${error}`);
  }
  const session = driver.session();
  try {
    console.log('connecting to session');
    await session.run(initCypher);
    await session.run(ReviewableQuery);
    console.log('Database initialized');
  } catch (error) {
    console.error(
      'Database initialization failed to complete\n',
      error.message
    );
  } finally {
    await session.close();
  }
};

const init = async (driver) => {
  await initializeDatabase(driver);
};

app.get('/', (req, res) => {
  res.send(JSON.stringify(req.headers));
});

(async () => {
  const server = new ApolloServer({
    context: ({ req, res }) => {
      console.log('every request', req.cookies, req.signedCookies);
      return {
        driver,
        neo4jDatabase: process.env.NEO4J_DATABASE,
        req,
        res,
      };
    },
    schema: schema,
    introspection: true,
    playground: true,
  });

  const port = process.env.PORT || 4001;
  const path = process.env.GRAPHQL_SERVER_PATH || '/graphql';

  server.applyMiddleware({ app, path });

  await init(driver);

  app.listen(port, () =>
    console.log(`🚀 Server ready at :${port}${server.graphqlPath}`)
  );
})();
