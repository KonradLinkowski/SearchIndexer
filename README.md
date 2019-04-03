# Search Indexer
Simple internet crawler for indexing websites.
## Search Engine
https://github.com/KonradLinkowski/SearchEngine
## Installation
### Environment variables
Set environment variables or create .env file containing:
```
MONGO_STRING=mongodb://<username>:<password>@<server address>/<database name>
```
### Running
```bash
git clone https://github.com/KonradLinkowski/SearchIndexer
cd SearchIndexer
yarn start
# or start with own url
yarn start https://example.com
```
