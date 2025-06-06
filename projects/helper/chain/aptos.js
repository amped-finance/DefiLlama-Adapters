const sdk = require('@defillama/sdk')

const http = require('../http')
const { getEnv } = require('../env')
const coreTokensAll = require('../coreAssets.json')
const { transformBalances } = require('../portedTokens')
const { log, getUniqueAddresses } = require('../utils')
const { GraphQLClient } = require("graphql-request");


const endpoint = () => getEnv('APTOS_RPC')
const movementEndpoint = () => getEnv('MOVE_RPC')

const endpointMap = {
  aptos: endpoint,
  move: movementEndpoint,
}


async function aQuery(api, chain = 'aptos') {
  return http.get(`${endpointMap[chain]()}${api}`)
}

async function getResources(account, chain = 'aptos') {
  const data = []
  let lastData
  let cursor
  do {
    let url = `${endpointMap[chain]()}/v1/accounts/${account}/resources?limit=9999`
    if (cursor) url += '&start=' + cursor
    const res = await http.getWithMetadata(url)
    lastData = res.data
    data.push(...lastData)
    sdk.log('fetched resource length', lastData.length)
    cursor = res.headers['x-aptos-cursor']
  } while (lastData.length === 9999)
  return data
}

async function getResource(account, key, chain = 'aptos') {
  if (typeof chain !== 'string') chain = 'aptos'
  let url = `${endpointMap[chain]()}/v1/accounts/${account}/resource/${key}`
  const { data } = await http.get(url)
  return data
}

async function getFungibles(tokenAddress, owners, balances) {
  const url = `https://api.aptoscan.com/public/v1.0/fungible_assets/${tokenAddress}/holders`
  const res = await http.get(url)
  const holders = res.data?.coin_holders_list || []
  if (!holders.length) return;
  holders.forEach(i => {
    if (!i.owner_address || i.is_frozen) return;
    const addr = i.owner_address.toLowerCase()
    if (!owners.includes(addr)) return;
    sdk.util.sumSingleBalance(balances, tokenAddress, i.amount)
  })
}

function dexExport({
  account,
  poolStr,
  token0Reserve = i => i.data.coin_x_reserve.value,
  token1Reserve = i => i.data.coin_y_reserve.value,
  getTokens = i => i.type.split('<')[1].replace('>', '').split(', '),
}) {
  return {
    timetravel: false,
    misrepresentedTokens: true,
    aptos: {
      tvl: async (api) => {
        const chain = api.chain
        const balances = {}
        let pools = await getResources(account, chain)
        pools = pools.filter(i => i.type.includes(poolStr))
        log(`Number of pools: ${pools.length}`)
        const coreTokens = Object.values(coreTokensAll[chain] ?? {})
        pools.forEach(i => {
          const reserve0 = token0Reserve(i)
          const reserve1 = token1Reserve(i)
          const [token0, token1] = getTokens(i)
          const isCoreAsset0 = coreTokens.includes(token0)
          const isCoreAsset1 = coreTokens.includes(token1)
          const nonNeglibleReserves = reserve0 !== '0' && reserve1 !== '0'

          if (isCoreAsset0 && isCoreAsset1) {
            sdk.util.sumSingleBalance(balances, token0, reserve0)
            sdk.util.sumSingleBalance(balances, token1, reserve1)
          } else if (isCoreAsset0) {
            sdk.util.sumSingleBalance(balances, token0, reserve0)
            if (nonNeglibleReserves)
              sdk.util.sumSingleBalance(balances, token0, reserve0)
          } else if (isCoreAsset1) {
            sdk.util.sumSingleBalance(balances, token1, reserve1)
            if (nonNeglibleReserves)
              sdk.util.sumSingleBalance(balances, token1, reserve1)
          }
        })

        return transformBalances(chain, balances)
      }
    }
  }
}

async function sumTokens({ balances = {}, owners = [], blacklistedTokens = [], tokens = [], api, chain = 'aptos', fungibleAssets = [] }) {
  if (api) chain = api.chain
  owners = getUniqueAddresses(owners, true)
  if (fungibleAssets.length > 0) await Promise.all(fungibleAssets.map(i => getFungibles(i, owners, balances)))
  const resources = await Promise.all(owners.map(i => getResources(i, chain)))
  resources.flat().filter(i => i.type.includes('::CoinStore')).forEach(i => {
    const token = i.type.split('<')[1].replace('>', '')
    if (fungibleAssets.includes(token)) return false // Prevents double counting if, for any reason, the token is present in both CoinStore and fungibleAsset
    if (tokens.length && !tokens.includes(token)) return;
    if (blacklistedTokens.includes(token)) return;
    sdk.util.sumSingleBalance(balances, token, i.data.coin.value)
  })
  return transformBalances(chain, balances)
}

async function getTableData({ table, data, chain = 'aptos' }) {
  const response = await http.post(`${endpointMap[chain]()}/v1/tables/${table}/item`, data)
  return response
}

async function function_view({ functionStr, type_arguments = [], args = [], ledgerVersion = undefined, chain = 'aptos' }) {
  let path = `${endpointMap[chain]()}/v1/view`
  if (ledgerVersion !== undefined) path += `?ledger_version=${ledgerVersion}`
  const response = await http.post(path, { "function": functionStr, "type_arguments": type_arguments, arguments: args })
  return response.length === 1 ? response[0] : response
}

function hexToString(hexString) {
  if (hexString.startsWith('0x')) hexString = hexString.slice(2);
  const byteLength = hexString.length / 2;
  const byteArray = new Uint8Array(byteLength);

  for (let i = 0; i < byteLength; i++) {
    const hexByte = hexString.substr(i * 2, 2);
    byteArray[i] = parseInt(hexByte, 16);
  }

  const decoder = new TextDecoder('utf-8');
  const stringValue = decoder.decode(byteArray);

  return stringValue
}

function sumTokensExport(options) {
  return async (api) => sumTokens({ ...api, api, ...options })
}

const graphQLClient = new GraphQLClient("https://api.mainnet.aptoslabs.com/v1/graphql");

// Query to get the latest block.
const latestBlockQuery = `query LatestBlock {
  block_metadata_transactions(order_by: {version: desc}, limit: 1) {
    block_height
  }
}`;

// Query to get a block.
const blockQuery = `query Block($block: bigint) {
  block_metadata_transactions(limit: 1, where: {block_height: {_eq: $block}}) {
    timestamp
    version
  }
}`;

// Query to get a block range.
const blockRangeQuery = `query Block($firstBlock: bigint, $limit: Int) {
  block_metadata_transactions(limit: $limit, where: {block_height: {_gte: $firstBlock}}, order_by: {block_height: asc}) {
    timestamp
    version
  }
}`;

// Given a timestamp, returns the transaction version that is closest to that timestamp.
const timestampToVersion = async (timestamp, minBlock = 0, chain = 'aptos') => {
  if (chain !== 'aptos') throw new Error('Unsupported chain');
  let left = minBlock;
  let right = await graphQLClient.request(latestBlockQuery).then(r => Number(r.block_metadata_transactions[0].block_height));
  let middle;
  while (left + 100 < right) {
    middle = Math.round((left + right) / 2);
    const middleBlock = await graphQLClient.request(blockQuery, { block: middle }).then(r => r.block_metadata_transactions[0]);
    const middleBlockDate = new Date(middleBlock.timestamp);
    if (middleBlockDate.getTime() === timestamp.getTime()) {
      return Number(middleBlock.version);
    }
    if (timestamp.getTime() < middleBlockDate.getTime()) {
      right = middle;
    } else {
      left = middle + 1;
    }
  }
  const blocks = await graphQLClient.request(
    blockRangeQuery,
    { firstBlock: left, limit: right - left }
  ).then(r => r.block_metadata_transactions);
  const mappedBlocks = blocks.map((e) => ({
    version: Number(e.version),
    delta: Math.abs(timestamp.getTime() - new Date(e.timestamp).getTime())
  }));
  mappedBlocks.sort((a, b) => a.delta - b.delta);
  return mappedBlocks[0].version;
}

module.exports = {
  endpoint: endpoint(),
  endpointMap,
  dexExport,
  aQuery,
  getResources,
  getResource,
  coreTokensAptos: Object.values(coreTokensAll['aptos']),
  sumTokens,
  sumTokensExport,
  getTableData,
  function_view,
  hexToString,
  timestampToVersion
};
