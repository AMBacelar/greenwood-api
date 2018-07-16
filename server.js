const express = require('express');
const app = express();
const neo4j = require('neo4j-driver').v1;

const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', '123456'));
const session = driver.session();

const personName = 'Alice';
const resultPromise = session.run(
    'CREATE (a:Person {name: $name}) RETURN a',
    {name: personName}
);

app.get('/', (req, res) => {
    resultPromise
    .then(result => {
        session.close();
    
        const singleRecord = result.records[0];
        const node = singleRecord.get(0);
    
        res.send(node.properties.name)
        console.log(node);
    
        // on application exit:
        driver.close();
    })
    .catch(err => {
        console.log(err);
    });
});

const port = process.env.PORT || 8080;

app.listen(port, () => console.log(`Example app listening on port ${port}!`));