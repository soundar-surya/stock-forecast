import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timeSeriesMain } from '../prediction';
import { ToastrService } from 'ngx-toastr';
import { FormControl } from '@angular/forms';
import {Observable} from 'rxjs';
import {map, startWith} from 'rxjs/operators';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
 

  trained_model = {}
  myControl = new FormControl();
  model: timeSeriesMain;
  input_temporal_resolutions: string;
  input_ticker:any;
  input_api_key: string;
  input_learningrate = 0.01;
  input_hiddenlayers = 4;
  input_trainingsize = 70;
  input_epochs = 5;
  div_display=false;
  loadingdata: boolean;
  linegraph_title: string;
  input_windowsize = 50;
  training_progressbar = 0;


  //graphs
  graph = { data: [], layout: {} };
  training_graph = { data: [], layout: {} };
  validate_graph = { data: [], layout: {} };
  predict_graph = { data: [], layout: {} }

  training_loading: boolean;
  predict_loadingdata: boolean;
  predict_ready:boolean;

  traininglog: string;
  training_div_display=false;
  predict_div_display: boolean;
  view: boolean;

  validate_loading: boolean;
  validate_div_display: boolean;


  stock_prices_raw: [];
  data_sma_vec: [];
  div_sma_display = true;
  sma_ready = false;
  training_ready = false;
  prediction_ready = false;
  validate_ready = false;
  symbols: [];
  temporal_resolutions: [string, string];
  toastr:ToastrService;
  loading_symbols:boolean
  filteredOptions: Observable<string[]>;



  constructor(private httpClient: HttpClient,toastr:ToastrService) {
    this.model = new timeSeriesMain(this.httpClient);
    this.toastr=toastr;
    this.view=false;
    this.input_temporal_resolutions = 'Daily';
    this.loading_symbols=true
   
   
    this.temporal_resolutions = ["Daily", "Weekly"]

    this.input_api_key = 'H24ORB6ISKPHJY10'


    this.div_display = false;
    this.loadingdata = false;
    this.linegraph_title = "";




    console.log("home component")
  }

  ngOnInit(): void {
   
  }
 

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    let tickerNames:string[]=this.symbols.map((val)=>{return val['name']})

    return tickerNames.filter(s => {
      console.log(s);
       s.includes(filterValue)
    });
  }

  errorMessage(message) {

     this.toastr.error(message)
  }

  successMessage(message){
    this.toastr.success(message);
  }


  public getToastr(): ToastrService {

    return this.toastr;
  }

  public async fetch(searchStr:String){
    
     
    if(searchStr!=undefined && searchStr.length%2!=0){
      console.log(searchStr.length)
      await this.model.fetchSymbols(searchStr).then(result => {
        this.symbols = result['data'].map(stock => {
          console.log(stock)
         
          return {
            symbol:stock['1. symbol'],
            name:stock['2. name']
          };
        });
        this.loading_symbols=false
  
  
  
    this.filteredOptions = this.myControl.valueChanges
        .pipe(
          startWith(''),
          map(value => this._filter(value))
        );
      })
    }
   

  }
  //get data
  async onClickFetchData() {
    console.log(this.input_ticker);
    //let the UI know that we are fetching data 

    if(!this.input_ticker){
      this.errorMessage("select a stock from the list")
      return;
    }
    this.loadingdata = true;
    let result:any;
    //request data to be fetched . providing the stock symbol , api key for data provider and whether daily,weekly,monthly,or yearly temporal dat
     await this.model.fetchData(this.input_ticker, this.input_api_key, this.input_temporal_resolutions).then(results=>{
      result =results
     }).catch((error)=>{
       console.log(error)
      this.errorMessage(error['error_message'])
      this.loadingdata=false;
      return
    })



    console.log(result)
    //hold the raw stock price data in a reference
    this.stock_prices_raw = result['stock_prices_raw'];

    //now we are ready to show the data in the UI but before we let the UI know we're done, let set up the data and make it ready to be displayed by initializing all the necessary  ui objects.
    this.div_display = true;
    this.training_div_display=false;
    this.linegraph_title = result['linegraph_title'];

    this.graph = {
      data: [{ x: result['timestamps'], y: result['prices'] }], //provide the graph with our axis
      layout: { height: 350, title: result['linegraph_title'], autosize: true } //set the hieght of out graph and it's title
    };
    window.dispatchEvent(new Event('resize'));

    //now we are done ,we are ready to compute the simple moving avarage of our data
    this.loadingdata = false;
    this.sma_ready = true;
    this.successMessage(this.input_temporal_resolutions+ " stock market price for "+this.input_ticker['name']+" loaded successfuly\n"+" Last updated:"+this.linegraph_title)

  }

  //dispaly SMA

  async onClickDisplaySMA() {

    this.loadingdata = true;
    console.log(this.stock_prices_raw)
    // compute the simple moving avarage of a set of closing stock-prices withing a single time window(windowsize), i.e 50 weeks
    let result = await this.model.compute_sma(this.stock_prices_raw, this.input_windowsize);


    //hold the reference of the list of sma object with the set and avarages and now we prepare our graph
    this.data_sma_vec = result['data_sma_vec'];
    this.div_sma_display = true;

    //show a line graph with stock prices and sma over time periods
    this.graph = {
      data: [
        { x: result['timestamps_a'], y: result['prices'], name: "Stock Prices" },
        { x: result['timestamps_b'], y: result['sma'], name: "Simple Moving Avarage" }
      ],
      layout: { height: 350, title: "Price and SMA (window:" + this.input_windowsize + ")", autosize: true }
    };
    window.dispatchEvent(new Event('resize'));
    this.loadingdata = false;
    this.training_ready = true;


  }

  modelChanged(newObj) {
    // do something with new value

    console.log(newObj)
  }

  //validate the model

  async onClickValidate() {


    //UI-controlls
    this.validate_loading = true;
    this.validate_div_display = true;




    //use stock prices as input to neural network
    let inputs = this.data_sma_vec.map(function (inp_f) {
      let temp = [];
      temp = inp_f['set']
      return temp.map(function (val) { return val['price']; });
    });
    // let outputs = this.data_sma_vec.map(function(outp_f) { return outp_f['avg']; });
    // let outps = outputs.slice(Math.floor(this.input_trainingsize / 100 * outputs.length), outputs.length);

    let pred_X = inputs.slice(Math.floor(this.input_trainingsize / 100 * inputs.length), inputs.length);





    console.log(pred_X);
    let pred_Y = await this.model.makePredictions(pred_X, this.trained_model['model']);



    let timestamps_a = this.stock_prices_raw.map((val) => {
      return val['timestamp']
    });
    let timestamps_b = this.stock_prices_raw.map(val => {

      return val['timestamp'];
    }).splice(this.input_windowsize, (this.stock_prices_raw.length - Math.floor((100 - this.input_trainingsize) / 100 * this.stock_prices_raw.length)));

    let timestamps_c = this.stock_prices_raw.map((val) => { return val['timestamp'] }).splice(this.input_windowsize + Math.floor(this.input_trainingsize / 100 * this.stock_prices_raw.length), this.stock_prices_raw.length);


    let sma = this.data_sma_vec.map((sma) => { return sma['avg'] });
    let prices = this.stock_prices_raw.map(stock => { return stock['price'] });

    console.log(pred_Y);
    this.training_graph = {
      data: [
        { x: timestamps_a, y: prices, name: "Actual Price" },
        { x: timestamps_b, y: sma, name: "Training label sma" },
        { x: timestamps_c, y: pred_Y, name: "Predicted" }

      ],
      layout: { height: 350, title: "Predict Results", autosize: true }

    }
    window.dispatchEvent(new Event('resize'));

    this.validate_loading = false;
    this.prediction_ready = true;




  }
  async onClickPredict() {
    this.predict_loadingdata = true;
    this.predict_div_display = true;

    let inputs = this.data_sma_vec.map(function (inp_f) {
      let temp = [];
      temp = inp_f['set']
      return temp.map(function (val) { return val['price']; });
    });
    let pred_X = [inputs[inputs.length - 1]];

    let pred_y = await this.model.makePredictions(pred_X, this.trained_model['model']);

    let timestamps_d = this.stock_prices_raw.map(function (val) {
      return val['timestamp'];
    }).splice((this.stock_prices_raw.length - this.input_windowsize), this.stock_prices_raw.length);

    // date
    let last_date = new Date(timestamps_d[timestamps_d.length - 1]);
    let add_days = 1;
    if (this.input_temporal_resolutions == 'Weekly') {
      add_days = 7;
    }
    last_date.setDate(last_date.getDate() + add_days);
    let next_date = await this.formatDate(last_date.toString());
    let timestamps_e = [next_date];

    this.predict_graph = {
      data: [
        { x: timestamps_d, y: pred_X[0], name: "Latest Trends" },
        { x: timestamps_e, y: pred_y, name: "Predicted Price" },
      ],
      layout: { height: 350, title: "Predict Results", autosize: true }
    };
    window.dispatchEvent(new Event('resize'));

    this.predict_loadingdata = false;

  }

  formatDate(date) {

    var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  trainModel() {
    this.training_div_display=true;
  }
  //train modell

  async onClickTrainModel() {

    // are you trainging ? if so then display the training div
    this.training_loading = true;
    this.training_div_display = true;


    let epoch_loss = [];
    this.traininglog = "";



    //inputs layer
    let inputstemp = this.data_sma_vec.map((inp_f) => {
      // console.log("Set==============",inp_f['set'])
      return inp_f['set'];
    });

    let inputs = inputstemp.map(val => {
      console.log(val)
      let temp = [];
      temp = val;
      return temp.map((res) => {

        return res['price'];
      })
    })

    let outputs = this.data_sma_vec.map((outp_f) => {
      return outp_f['avg'];
    })

    let callback = function (epoch, log, model_params) {

      this.traininglog = "<div> Epoch :" + (epoch + 1) + " (of " +  model_params['input_epoch'] + ")" +
        ", loss:: " + log.loss + "</div>" + this.traininglog;

      epoch_loss.push(log.loss);
      console.log('log', log);
      this.training_progressbar = Math.ceil(((epoch + 1) * (100 / this.input_epoch)));

      this.training_graph = {
        data: [{ X: Array.from({ length: epoch_loss.length }, (v, k) => k + 1), y: epoch_loss, name: "Loss" }],
        layout: { height: 350, title: "Training Loss", autosize: true }
      };
      window.dispatchEvent(new Event('resize'))



    }
    let model_params = {
      "inputs": inputs,
      "outputs": outputs,
      "input_trainingsize": this.input_trainingsize,
      "input_windowsize": this.input_windowsize,
      "input_epoch": this.input_epochs,
      "input_learningrate": this.input_learningrate,
      "input_hiddenlayers": this.input_hiddenlayers
    };

    this.trained_model = await this.model.trainModel(model_params, callback.bind(this));
    this.traininglog = "<div> Model trained</div>" + this.traininglog;
    this.training_loading = false;
    this.validate_ready = true;



  }

}
