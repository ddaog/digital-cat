const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const KAKAO_ADMIN_KEY = process.env.KAKAO_ADMIN_KEY;
const KAKAO_CID = process.env.KAKAO_CID || 'TC0ONETIME';

let tid = '';

// 1. Payment Ready
app.post('/api/payment/ready', async (req, res) => {
    try {
        const baseUrl = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
        const response = await axios.post(
            'https://open-api.kakaopay.com/online/v1/payment/ready',
            {
                cid: KAKAO_CID,
                partner_order_id: 'order_id_1',
                partner_user_id: 'user_id_1',
                item_name: '츄르',
                quantity: 1,
                total_amount: 1000,
                tax_free_amount: 0,
                approval_url: `${baseUrl}/api/payment/success`,
                fail_url: `${baseUrl}/api/payment/fail`,
                cancel_url: `${baseUrl}/api/payment/cancel`,
            },
            {
                headers: {
                    Authorization: `SECRET_KEY ${KAKAO_ADMIN_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        tid = response.data.tid;
        res.json(response.data);
    } catch (error) {
        const errorData = error.response ? error.response.data : { message: error.message };
        console.error('Payment Ready Error:', JSON.stringify(errorData));
        res.status(500).json({
            error: 'Failed to prepare payment',
            details: errorData
        });
    }
});

// 2. Payment Success Redirect (Handle Approval)
app.get('/api/payment/success', async (req, res) => {
    const { pg_token } = req.query;

    try {
        const response = await axios.post(
            'https://open-api.kakaopay.com/online/v1/payment/approve',
            {
                cid: KAKAO_CID,
                tid: tid,
                partner_order_id: 'order_id_1',
                partner_user_id: 'user_id_1',
                pg_token: pg_token,
            },
            {
                headers: {
                    Authorization: `SECRET_KEY ${KAKAO_ADMIN_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        res.redirect('/?payment=success');
    } catch (error) {
        console.error('Payment Approve Error:', error.response ? error.response.data : error.message);
        res.redirect('/?payment=fail');
    }
});

app.get('/api/payment/fail', (req, res) => {
    res.redirect('/?payment=fail');
});

app.get('/api/payment/cancel', (req, res) => {
    res.redirect('/?payment=cancel');
});

// Export the app for Vercel
module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
