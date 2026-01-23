#!/bin/bash

echo "Waiting for MongoDB to start..."

until mongosh --host mongo:27017 --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  echo "MongoDB not ready yet, waiting..."
  sleep 2
done

echo "MongoDB is ready, initializing replica set..."
mongosh --host mongo:27017 --eval '
  try {
    const status = rs.status();
    print("Replica set already initialized");
  } catch (e) {
    print("Initializing replica set...");
    rs.initiate({
      _id: "rs0",
      members: [{ _id: 0, host: "mongo:27017" }]
    });
  }
'

sleep 3
echo "Replica set initialized!"