

const { createClient } = require('pexels');
// Your API key: 563492ad6f9170000100000133b7e32ab3b449a18d02926de6111c44

// https://api.pexels.com/v1/
// https://api.pexels.com/videos/

const client = createClient('563492ad6f9170000100000133b7e32ab3b449a18d02926de6111c44');
const query = 'good+morning';

client.photos.search({ query, per_page: 1 }).then(({photos: [{src: { original }} ]}) => {
    console.log({original});
});