const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config();

const app = express();

//middleWare
app.use(cors());
app.use(express.json());






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.nfiuyyd.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        const appointmentListOptionsCollection = client.db('doctorPortal').collection('appointmentList');
        const bookingCollections = client.db('doctorPortal').collection('bookingOptions');


        //use aggregate to query multiple collection and then merge data
        app.get('/appointmentOption', async (req, res) => {
            const date = req.query.date;
            // console.log(date)
            const query = {};
            const options = await appointmentListOptionsCollection.find(query).toArray();
            const bookingQuery = { appointmentDate: date }
            const alreadyBooked = await bookingCollections.find(bookingQuery).toArray();
            //code carefully
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
                const bookedSlots = optionBooked.map(book => book.slot)
                const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot));
                option.slots = remainingSlots;
            })
            res.send(options)
        })


        //post------------------------------------------
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const query = {
                appointmentDate: booking.appointmentDate,
                email: booking.email,
                treatment: booking.treatment
            }

            const alreadyBooked = await bookingCollections.find(query).toArray();

            if (alreadyBooked.length) {
                const message = `You already have a booking on ${booking.appointmentDate}`
                return res.send({ acknowledged: false, message })
            }

            const result = await bookingCollections.insertOne(booking);
            res.send(result);
        })



        /**
         * simple convention for booking api
         * app.get('booking)
         * app.get('booking/:id')
         * app.post('booking')
         * app.patch('booking/:id')
         * app.delete('booking/:id')
         */
    }
    finally {

    }
}

run();



//------------------------------------------------------------------------
app.get('/', async (req, res) => {
    res.send('Doctor Portal server Is Running')
})

app.listen(port, () => {
    console.log(`Doctor portal server running on port ${port}`)
})