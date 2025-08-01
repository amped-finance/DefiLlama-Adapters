const ADDRESSES = require("../helper/coreAssets.json");
const { staking } = require("../helper/staking");
const { sumTokensExport } = require("../helper/unknownTokens");
const axios = require('axios');

const lisLPs = [
    "0xe8f4644637f127aFf11F9492F41269eB5e8b8dD2", // Lista LP Stable-LP
    "0xFf5ed1E64aCA62c822B178FFa5C36B40c112Eb00", // Lista LP aSnBNB-WBNB
    "0x4b2D67Bf25245783Fc4C33a48962775437F9159c", // Lista LP aUSDT-LISTA
    "0xC23d348f9cC86dDB059ec798e87E7F76FBC077C1", // Lista LP aHAY-USDT
    "0xF6aB5cfdB46357f37b0190b793fB199D62Dcf504", // Lista LP UV-17-THE
    "0x1Cf9c6D475CdcA67942d41B0a34BD9cB9D336C4d", // Lista LP sAMM-HAY/FRAX
    "0x9eb77a54a33069a319d91f493e6b1c9066fb38f7" // Lista LP pancake lisUSD/USDT
    
  ];

  
const abi = {
    lpToken: "address:lpToken",
    totalSupply: "uint256:totalSupply",
};

const pool2 = async (api) => {
    const [lisLpTokens, lisLpBalances] = await Promise.all([
        api.multiCall({calls: lisLPs.map((lis) => ({ target: lis })), abi: abi.lpToken }),
        api.multiCall({calls: lisLPs.map((lis) => ({ target: lis })), abi: abi.totalSupply }),
      ]);


      lisLPs.forEach((_lp, i) => {

        api.add(lisLpTokens[i], lisLpBalances[i])
      })

    
  
}

module.exports = {
    methodology: "The TVL is calculated by summing the values of tokens held in the specified vault addresses",
    hallmarks: [
        [1669939200, "aBNBc exploit"],
        //[1670544000,"aBNBc to AnkrBNB swap & HAY buyback"]
    ],
    bsc: {
        tvl: async (api) => {
            let tokensAndOwners;
            try {
                const { data } = await axios.get('https://api.lista.org/api/defiLlama/cdp-vault-list');
                if (data && data.code === '000000000' && Array.isArray(data.data)) {
                    tokensAndOwners = data.data;
                } else {
                    throw new Error('Invalid API response');
                }
            } catch (e) {
                // fallback to static if API fails
                tokensAndOwners = [
                    [ADDRESSES.null, "0x986b40C2618fF295a49AC442c5ec40febB26CC54"],
                    ["0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B", "0x6F28FeC449dbd2056b76ac666350Af8773E03873"],
                    ["0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B", "0x91e49983598685DD5ACAc90CEb4061A772f6E5Ae"],
                    [ADDRESSES.bsc.ETH, "0xA230805C28121cc97B348f8209c79BEBEa3839C0"],
                    [ADDRESSES.bsc.wBETH, "0xf45C3b619Ee86F653805E007fE211B7e930E0b3B"],
                    [ADDRESSES.bsc.wBETH, "0xA230805C28121cc97B348f8209c79BEBEa3839C0"],
                    [ADDRESSES.bsc.BTCB, "0xad9eAAe95617c39019aCC42301a1dCa4ea5b6f65"],
                    [ADDRESSES.blast.ezETH, "0xd7E33948e2a43e7C1ec2F19937bf5bf8BbF9BaE8"],
                    [ADDRESSES.blast.weETH, "0x2367f2Da6fd39De6944218CC9EC706BCdc9a6918"],
                    [ADDRESSES.scroll.STONE, "0x876cd9a380Ee7712129b52f8293F6f06056c3104"],
                    ["0x4aae823a6a0b376De6A78e74eCC5b079d38cBCf7", "0xA94AA72e033b39AD7CD448f38Bc1eda5B52f7079"],
                    ["0xF5e11df1ebCf78b6b6D26E04FF19cD786a1e81dC", "0x157c9a692ee99C39272856055957083a928cE299"],
                    ["0x26c5e01524d2E6280A48F2c50fF6De7e52E9611C", "0xf8Ca8D2B59A97125751af1069d4a5C4F7eB7A677"],
                    ["0x1346b618dC92810EC74163e4c27004c921D446a5","0x03DB750d6212C6a0BCa9258E8cB7cf46dfD63067"],
                    [ADDRESSES.bsc.USDT, "0xAd406CcF75f9E6216fA4349635B0cD77D0059b1f"],
                    [ADDRESSES.ethereum.FDUSD,"0x2202a491752Fee0E616F06A89E2eF416E2Fcd7e9"],
                    ["0x7788A3538C5fc7F9c7C8A74EAC4c898fC8d87d92", "0x98b167359566c1ea05335D52794C7Eb6f8E6739a"],
                    ["0xfd5840cd36d94d7229439859c0112a4185bc0255","0xf76D9cFD08dF91491680313B1A5b44307129CDa9"],
                    ["0xf9C4FF105803A77eCB5DAE300871Ad76c2794fa4", "0xEA44dDC58eC6b4902E19A353c554B6A4F32b9e6E"],
                    ["0x7c1cCA5b25Fa0bC9AF9275Fb53cBA89DC172b878", "0x8A016f1896dC2939fFDbB60f6E42bCc245e2bB0b"],
                    ["0x581FA684D0Ec11ccb46B1d92F1F24C8A3F95C0CA", "0x605356cc9f725e6744A51E78CD49E6029DcC4404"],
                    ["0x7dc91cbd6cb5a3e6a95eed713aa6bf1d987146c8", "0x3cd434f0A58018B87eF1D2436cb710ca46F0fC43"],
                    ["0x5A110fC00474038f6c02E89C707D638602EA44B5", "0x8B35291ecF29fD36BA405A03C9832725f2E9e164"],
                    ["0x917AF46B3C3c6e1Bb7286B9F59637Fb7C65851Fb", "0xB53e69b662a2d10343f857eBa9e3b6158Acf632F"],
                    [ADDRESSES.bsc.BTCB, "0x1AfA1589a634BE568D7872dCF1bbE6F79e11FaD5"],
                ];
            }
            return sumTokensExport({ tokensAndOwners })(api);
        },
        pool2,
        staking: staking('0xd0C380D31DB43CD291E2bbE2Da2fD6dc877b87b3','0xFceB31A79F71AC9CBDCF853519c1b12D379EdC46')
    },
};

// execute with `node test.js projects/helio-money`