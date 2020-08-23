const neo4j = require('neo4j-driver');
const _ = require('lodash');

const { randomColor } = require('./utils/randomColour');
const { slugify } = require('./utils/createSlug');
const { result } = require('lodash');

const buildSessionParams = (ctx) => {
  let paramObj = {};

  if (ctx.neo4jDatabase) {
    paramObj['database'] = ctx.neo4jDatabase;
  }

  if (ctx.neo4jBookmarks) {
    paramObj['bookmarks'] = ctx.neo4jBookmarks;
  }
  return paramObj;
};

const runQuery = async (query, context, resolveInfo) => {
  if (context.neo4jDatabase || context.neo4jBookmarks) {
    const sessionParams = buildSessionParams(context);
    try {
      // connect to the specified database and/or use bookmarks
      // must be using 4.x version of driver
      session = context.driver.session(sessionParams);
    } catch (e) {
      // throw error if bookmark is specified as failure is better than ignoring user provided bookmark
      if (context.neo4jBookmarks) {
        throw new Error(
          `context.neo4jBookmarks specified, but unable to set bookmark in session object: ${e.message}`
        );
      }
    }
  } else {
    // no database or bookmark specified
    session = context.driver.session();
  }

  let result;

  try {
    result = await session.run(query);
    result = result.records[0].get(0);
  } finally {
    session.close();
  }
  return result.properties[resolveInfo.fieldName];
};

const resolvers = {
  Business: {
    bannerColour: (obj, args, context, resolveInfo) => randomColor(),
    dateCreated: (obj, args, context, resolveInfo) => {
      return Date.now();
    },
    slug: async (obj, args, context, resolveInfo) => {
      const field = 'businessId';
      const node = 'Business';
      const setSlug = `
        MATCH (n: ${node} {${field}: "${obj[field]}"})
        FOREACH (ignoreMe in CASE
          WHEN exists(n.slug) THEN [1]
            ELSE [] END | SET n.slug=n.slug)
        FOREACH (ignoreMe in CASE
          WHEN not(exists(n.slug)) THEN [1]
            ELSE [] END | SET n.slug = "${slugify(obj.name, {
              lower: true,
              remove: /[*+~.()'"!:@]/g,
            })}")
        RETURN n
      `;
      return await runQuery(setSlug, context, resolveInfo);
    },
  },
};

module.exports = { resolvers };
