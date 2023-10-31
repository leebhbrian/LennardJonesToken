import React, { useState, useEffect } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Grid from '@mui/material/Grid';
import { ABI } from './LJabi';
import { ethers } from 'ethers';
import Plot from 'react-plotly.js';
import Papa from 'papaparse';
import InputLabel from '@mui/material/InputLabel';

function App() {
  //Set values
  const [csvContent, setCsvContent] = useState('');
  const [tokBalance, setTokBalance] = useState('');
  const [ethBalance, setethBalance] = useState('');
  const [provider, setProvider] = useState([]);
  const [signer, setSigner] = useState([]);
  const [contract, setContract] = useState([]);
  const [contractsign, setContractsign] = useState([]);
  const [plotData, setPlotData] = useState([]);
  const [calcData, setCalcData] = useState([]);

  const [dataLabel, setDataLabel] = useState([]);
  const [topRate, setTopRate] = useState([]);
  const [topBalance, setTopBalance] = useState([]);
  const [tradeAddress, setTradeAddress] = useState([]);
  const [tradeAmount, setTradeAmount] = useState([]);
  const [inputTradeAddress, setInputValueTradeAddress] = useState([]);
  const [inputTradeAmount, setInputValueTradeAmount] = useState([]);
  const [outputenergy, setoutputenergy] = useState([]);
  const [npart, setnpart] = useState([]);
  const [inputnpart, setInputnpart] = useState([]);
  const [inputenergy, setInputenergy] = useState([]);
  const [dataAccess, setDataAccess] = useState([]);
  const [tradeRate, setTradeRate] = useState([]);
  const [inputTradeRate, setInputValueTradeRate] = useState([]);
  const [ratefromcontract, setratefromcontract] = useState([]);


  useEffect(() => {
    if (typeof window.ethereum !== 'undefined' || (typeof window.web3 !== 'undefined')) {
      console.log('MetaMask is installed!');
    } else {
      console.log('Install MetaMask!');
    }
    setDataLabel('Upload or query data');
  }, []);

  //Connect to Metamask
  const connectToMetaMask = async () => {
    if (window.ethereum) {
      try {
        //Get the provider from Metamask
        const provider = new ethers.providers.Web3Provider(window.ethereum)
        const signer = provider.getSigner()

        //Specify the contract ABI and address
        const contractAddress = '0x717a61B4F194ACA49DE4fBAA71E083C5660668E5';
        const contract = new ethers.Contract(contractAddress, ABI, provider);
        const contractsign = contract.connect(signer);
        const balanceETH = await provider.getBalance(signer.getAddress());

        //Set the user properties and balance
        setethBalance(ethers.utils.formatEther(balanceETH));
        setProvider(provider);
        setSigner(signer);
        setContract(contract);
        setContractsign(contractsign);
        const balanceTOK = await contract.balanceOf(signer.getAddress());
        setTokBalance(Number(balanceTOK) / 10 ** (18));
        const dataAccess = await contractsign.viewAccess();
        setDataAccess(dataAccess.map(Number));
        const ratenow = await contract.getexrate(signer.getAddress());
        setratefromcontract(ratenow[1]);
      } catch (error) {
        console.error(error);
      }
    } else {
      window.alert('Non-Ethereum browser detected. You should consider installing MetaMask.');
    }
  };

  //Update balance
  const updateBalance = async () => {
    const balanceETH = await provider.getBalance(signer.getAddress());
    setethBalance(ethers.utils.formatEther(balanceETH));
    const balanceTOK = await contract.balanceOf(signer.getAddress());
    setTokBalance(Number(balanceTOK) / 10 ** (18));
    const dataAccess = await contractsign.viewAccess();
    setDataAccess(dataAccess.map(Number));
    const ratenow = await contract.getexrate(signer.getAddress());
    setratefromcontract(ratenow[1]);
  };

  //Update top balance and rate
  const updateTopTrade = async () => {
    const ratedat = await contract.viewTopRate();
    const addresses = ratedat[0];
    const rates = ratedat[1];
    const topRate1 = addresses.map((address, index) => `${index + 1}\n Address: ${address}\n Rate: ${rates[index]}`);
    const topRate = topRate1.join('\n\n');
    setTopRate(topRate);

    const baldat = await contract.viewTopBalance();
    const addresses2 = baldat[0];
    const rates2 = baldat[1];
    const topBal1 = addresses2.map((address, index) => `${index + 1}\n Address: ${address}\n Balance: ${rates2[index] / 10 ** (18)}`);
    const topBal = topBal1.join('\n\n');
    setTopBalance(topBal);
  };

  //Trade LJT and ETH
  const runTrade = async () => {
    const ethValue = ethers.utils.parseEther(tradeAmount.toString());
    try {
      const trade_tx = await contractsign.buyToken(tradeAddress, { value: ethValue });
      const receipt = await trade_tx.wait();
      updateBalance();
    } catch (err) {
      console.log("Trade error", err);
    }
  };

  //Set rate of LJT/ETH
  const setRate = async () => {
    try {
      const tx = await contractsign.setExchangeRate(tradeRate);
      const receipt = await tx.wait();
      const ratenow = await contract.getexrate(signer.getAddress());
      setratefromcontract(ratenow[1]);
    } catch (err) {
      console.log("Exchange error", err);
    }
  };

  //Calculate energy
  const getEcalc = async () => {
    const energy = await contract.calcEnergy(calcData);
    setoutputenergy(energy * 1e-18);
  };

  //Mine token
  const getMine = async () => {
    const tx = await contractsign.mineToken(calcData);
    const receipt = await tx.wait();
    const event = receipt.events.pop();
    const result = Number(event.args[0]);
    const energy = await contract.calcEnergy(calcData);
    setoutputenergy(energy * 1e-18);
  };

  //Add access of LJ cluster data
  const addAccess = async () => {
    const tx = await contractsign.gainAccess(npart);
    await tx.wait();
    const dataAccess = await contractsign.viewAccess();
    setDataAccess(dataAccess.map(Number));
  };

  //Query data
  const getQuery = async () => {
    try {
      //data[0] is energy, data[1] is position. They need to be converted to the right format.
      const data = await contractsign.viewData(npart);
      const energy = Number(data[0] * 1e-18);
      const posin = data[1].map(Number);
      const pos = posin.map(num => num * Math.pow(10, -6));

      //Convert the position array to a string
      let posString = "x,y,z\n";
      setoutputenergy(energy);

      //Convert the position array to a Plotly-friendly format
      const xdat = [];
      const ydat = [];
      const zdat = [];

      for (let i = 0; i < pos.length; i++) {
        posString += pos[i];
        if ((i + 1) % 3 === 0) {
          posString += "\n";
        } else {
          posString += ",";
        }

        if (i % 3 === 0) {
          xdat.push(pos[i]);
        } else if (i % 3 === 1) {
          ydat.push(pos[i]);
        } else {
          zdat.push(pos[i]);
        }
      }
      setCsvContent(posString);

      setPlotData([
        {
          type: 'scatter3d',
          mode: 'markers',
          x: xdat,
          y: ydat,
          z: zdat,
          marker: {
            size: 8,
            color: 'dimgray',
          },
        },
      ]);
    } catch (error) {
      if (error.code === ethers.utils.Logger.errors.CALL_EXCEPTION) {
        alert("The requirement in the Query function was not met.");
      } else {
        alert("An unknown error occurred.");
      }
    }
  };

  //Handle change in trade address
  const handleChangeTradeAddress = (event) => {
    const value = event.target.value;
    setInputValueTradeAddress(value);
    setTradeAddress(value);
  };

  //Handle change in number of particles
  const handlenpart = (event) => {
    const value = event.target.value;

    // Update the input field value
    setInputnpart(value);
    const parsedValue = parseInt(value, 10);

    // Check if the parsed value is a number
    if (!isNaN(parsedValue)) {
      setnpart(parsedValue);
    } else {
      // If the parsed value is not a number (e.g., user entered non-numeric characters),
      // you can set savedInteger to null or keep the last valid value, depending on your use case.
      setnpart(null);
    }
  };

  //Handle change in energy
  const handleinenergy = (event) => {
    const value = event.target.value;

    // Update the input field value
    setInputenergy(value);
  };

  //Handle change in trade amount
  const handleChangeTradeAmount = (event) => {
    const value = event.target.value;

    // Update the input field value
    setInputValueTradeAmount(value);

    // Check if the parsed value is a number
    if (!isNaN(value)) {
      setTradeAmount(value);
    } else {
      setTradeAmount(null);
    }
  };

  //Handle change in trade rate
  const handleChangeTradeRate = (event) => {
    const value = event.target.value;
    setInputValueTradeRate(value);
    const parsedValue = parseInt(value, 10);
    // Check if the parsed value is a number
    if (!isNaN(parsedValue)) {
      setTradeRate(parsedValue);
    } else {
      setTradeRate(null);
    }
  };

  //Handle file upload to update the plot and CSV content
  const handleFileRead = (event) => {
    const file = event.target.files[0];
    setDataLabel('User input coordinate');

    //Fill the calcData array with the uploaded data
    let reader = new FileReader();
    Papa.parse(file, {
      complete: (result) => {
        // Remove the header row
        const data = result.data.slice(1);
        const flatData = [].concat(...data).map(Number);
        const calcData = flatData.map(x => Math.floor(x * 1e6));
        setCalcData(calcData.slice(0, -1));
      }
    });

    //Parse the data and plot it
    reader.onload = function (e) {
      const content = e.target.result;
      setCsvContent(content);

      Papa.parse(content, {
        header: true,
        dynamicTyping: true,
        complete: function (result) {
          const xValues = result.data.map((row) => row.x);
          const yValues = result.data.map((row) => row.y);
          const zValues = result.data.map((row) => row.z);
          setInputnpart(xValues.length - 1);
          setnpart(xValues.length - 1);
          setPlotData([
            {
              type: 'scatter3d',
              mode: 'markers',
              x: xValues,
              y: yValues,
              z: zValues,
              marker: {
                size: 8,
                color: 'dimgray',
              },
            },
          ]);
        },
      });
    };
    reader.readAsText(file);
    setoutputenergy('Press calculate energy.');
  };

  return (
    <div style={{ padding: 20 }}>
      <Grid container spacing={2}>
        {/* First Row */}
        <Grid item>
          <Button variant="contained" color="primary" onClick={connectToMetaMask}>
            Connect wallet
          </Button>
        </Grid>
        <Grid item>
          <Button variant="contained" color="secondary" onClick={updateBalance}>
            Update balance
          </Button>
        </Grid>
        <Grid item>
          <TextField label="ETH balance" variant="outlined" InputLabelProps={{ shrink: true }} value={ethBalance} />
        </Grid>
        <Grid item>
          <TextField label="LJ Token balance" variant="outlined" InputLabelProps={{ shrink: true }} value={tokBalance} />
        </Grid>
        <Grid item>
          <TextField label="Your accessible data" variant="outlined" InputLabelProps={{ shrink: true }} value={dataAccess} />
        </Grid>
        <Grid item>
          <TextField label="Your rate LJT/ETH" variant="outlined" InputLabelProps={{ shrink: true }} value={ratefromcontract} />
        </Grid>
        {/* Second Row */}
        <Grid container spacing={2} style={{ marginTop: 20 }}>
          <Grid item container direction="column" justifyContent="flex-start" xs={2}>
            <Button variant="contained" color="primary" onClick={updateTopTrade}>
              Top balance/rate
            </Button>

            <Button variant="contained" color="success" style={{ marginTop: '20px' }} onClick={setRate}>
              Set your rate
            </Button>

            <Button variant="contained" color="secondary" style={{ marginTop: '20px' }} onClick={runTrade}>
              Trade
            </Button>
          </Grid>
          <Grid item>
            <TextField
              label="Top balance"
              variant="outlined"
              multiline
              rows={10}
              value={topBalance}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item>
            <TextField
              label="Top rate"
              variant="outlined"
              multiline
              rows={10}
              value={topRate}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item container direction="column" justifyContent="flex-start" xs={3}>
            <TextField
              label="Trade address"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              value={inputTradeAddress}
              onChange={handleChangeTradeAddress}
            />
            <TextField
              label="Trade token amount"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              style={{ marginTop: '20px' }}
              value={inputTradeAmount}
              onChange={handleChangeTradeAmount}
            />
            <TextField
              label="Set your rate"
              variant="outlined"
              InputLabelProps={{ shrink: true }}
              style={{ marginTop: '20px' }}
              value={inputTradeRate}
              onChange={handleChangeTradeRate}
            />

          </Grid>
        </Grid>

        {/* Third Row */}
        <Grid container spacing={2} style={{ marginTop: 20 }}>
          <Grid item>
            <InputLabel htmlFor="csv-upload">Upload CSV of LJ positions</InputLabel>
            <input type="file" accept=".csv" onChange={handleFileRead} />
          </Grid>
          <Grid item container direction="column" justifyContent="flex-start" xs={2}>
            <Button variant="contained" color="primary" onClick={getMine}>
              Mine
            </Button>
            <Button variant="contained" color="secondary" onClick={getEcalc} style={{ marginTop: '10px' }}>
              Calculate energy
            </Button>
          </Grid>
          <Grid item container direction="column" justifyContent="flex-start" xs={2}>
            <Button variant="contained" color="success" onClick={getQuery}>
              Query
            </Button>
            <Button variant="contained" color="warning" onClick={addAccess} style={{ marginTop: '10px' }}>
              Add access
            </Button>
          </Grid>
          <Grid item>
            <TextField label="Num. particles" variant="outlined" value={inputnpart} InputLabelProps={{ shrink: true }} style={{ width: 150 }} onChange={handlenpart} />
          </Grid>
          <Grid item>
            <TextField label="Energy" variant="outlined" value={outputenergy} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item>
            <TextField label="Energyinput" variant="outlined" value={inputenergy} InputLabelProps={{ shrink: true }} style={{ width: 150 }} onChange={handleinenergy} />
          </Grid>
        </Grid>

        {/* Fourth Row */}
        <Grid container spacing={2} style={{ marginTop: 20 }}>
          <Grid item xs={6}>
            <Plot
              data={plotData}
              layout={{
                width: 400,
                height: 400,
                xaxis: {
                  showline: false,
                  zeroline: false,
                  showticklabels: false,
                  showgrid: false,
                },
                yaxis: {
                  showline: false,
                  zeroline: false,
                  showticklabels: false,
                  showgrid: false,
                },
                zaxis: {
                  showline: false,
                  zeroline: false,
                  showticklabels: false,
                  showgrid: false
                },
                margin: { l: 0, r: 0, b: 0, t: 0 },
              }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label={dataLabel}
              variant="outlined"
              multiline
              rows={10}
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={csvContent}
            />
          </Grid>
        </Grid>
      </Grid>
    </div>
  );
}

export default App;
