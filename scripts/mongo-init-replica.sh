#!/bin/bash

echo "Waiting for MongoDB to start..."
sleep 5

echo "Initializing replica set..."
mongosh --host mongo:27017 --eval '
  rs.status().ok || rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }]
  })
'

echo "Replica set initialized!"