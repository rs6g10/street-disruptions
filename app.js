// require the dependencies we installed
const app = require('express')();
const responseTime = require('response-time');
const axios = require('axios');
const redis = require('redis');

// create a new redis client and connect to our local redis instance
const client = redis.createClient();

// if an error occurs, print it to the console
client.on('error', function(err) {
  console.log('Error ' + err);
});

app.set('port', (process.env.PORT || 5000));
// set up the response-time middleware
app.use(responseTime());

// call the TFL API to fetch information about street disruptions
const getDisruptions = (start, end) => {
  const tflEndpoint = `https://api.tfl.gov.uk/Road/all/Street/Disruption?startDate=${start}&endDate=${end}`;
  return axios.get(tflEndpoint);
}

const getToday = () => {
  const today = new Date();
  let dd = today.getDate();
  let mm = today.getMonth() + 1; //January is 0!
  const yyyy = today.getFullYear();

  if (dd < 10) {
    dd = '0' + dd;
  }

  if (mm < 10) {
    mm = '0' + mm;
  }

  return mm + '/' + dd + '/' + yyyy;
}

// if a user visits /api/facebook, return the total number of stars 'facebook'
// has across all it's public repositories on GitHub
app.get('/api/disruptions', (req, res) => {
  const today = getToday();
  const start = req.query.start || today;
  const end = req.query.end || today;
  client.get(today, (error, result) => {

    if (result) {
      // the result exists in our cache - return it to our user immediately
      res.send({ disruptions: JSON.parse(result), source: 'redis cache' });
    } else {
      // we couldn't find the key "coligo-io" in our cache, so get it
      // from the GitHub API
      getDisruptions(start, end).then(function(data) {
        // store the key-value pair (username:totalStars) in our cache
        // with an expiry of 1 minute (60s)
        client.setex(today, 30 * 60, JSON.stringify(data));
        // return the result to the user
        res.send({ disruptions: data, source: 'TFL API' });
      }).catch(function(response) {
        if (response.status === 404) {
          res.send('No disruption data');
        } else {
          res.send(response);
        }
      });
    }

  });
});

app.listen(app.get('port'), () => {
  console.log('Server listening on port: ', app.get('port'));
});