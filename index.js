const express = require('express');
const app = express();
const { createClient } = require('@supabase/supabase-js');
const bodyParser = require('body-parser');
const cors = require('cors');
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Read
app.get('/api/get', async (req, res) => {
  try {
    const { data, error } = await supabase.from('user_infos').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch user's data for code confirmation
app.post('/api/fetch_user_infos', async (req, res) => {
  const { Reg_email } = req.body;
  try {
    const { data, error } = await supabase
      .from('user_infos')
      .select('*')
      .eq('useremail_reg', Reg_email);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Password Check
app.post('/api/userpass/check', async (req, res) => {
  const { Reg_email, Reg_password } = req.body;
  try {
    const { data, error } = await supabase
      .from('user_infos')
      .select('userpassword_reg, username_reg, useravatar_url, confirmed')
      .eq('useremail_reg', Reg_email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No matching record found (email doesn't exist)
        return res.json({
          exists: false,
          confirmed: false,
          correct_pass: false,
          message: 'User not found'
        });
      }
      throw error;
    }

    const isMatch = await bcrypt.compare(Reg_password, data.userpassword_reg);

    const responseObj = {
      exists: true,
      username_reg: data.username_reg,
      useravatar_url: data.useravatar_url,
      confirmed: data.confirmed,
      correct_pass: isMatch,
      message: isMatch ? 'Login successful' : 'Incorrect password'
    };

    if (!data.confirmed) {
      responseObj.message = 'Account not confirmed';
    }

    res.json(responseObj);

  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({
      exists: false,
      confirmed: false,
      correct_pass: false,
      message: 'An error occurred during authentication'
    });
  }
});

// Password update
app.put('/api/userpass/update', async (req, res) => {
  const { Reg_email, Reg_password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(Reg_password, 10);
    const { data, error } = await supabase
      .from('user_infos')
      .update({ userpassword_reg: hashedPassword })
      .eq('useremail_reg', Reg_email);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Username update
app.put('/api/username/update', async (req, res) => {
  const { Reg_email, Reg_username } = req.body;
  try {
    const { data, error } = await supabase
      .from('user_infos')
      .update({ username_reg: Reg_username })
      .eq('useremail_reg', Reg_email);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scoreList/post', async (req, res) => {
  const { useremail_reg } = req.body;
  try {
    const { data, error } = await supabase
      .from('quiz_statistics')
      .select(`
        useremail_reg,
        user_score,
        questions_total,
        quiz_taken,
        user_infos (useravatar_url, username_reg)
      `)
      .eq('useremail_reg', useremail_reg)
      .order('quiz_taken', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/topScore/get', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quiz_statistics')
      .select('*')
      .order('user_score', { ascending: false })
      .order('quiz_taken', { ascending: false })
      .limit(7);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/profileScore/get', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quiz_statistics')
      .select(`
        useremail_reg,
        user_score,
        questions_total,
        quiz_taken,
        user_infos (useravatar_url, username_reg)
      `)
      .order('user_score', { ascending: false })
      .order('quiz_taken', { ascending: false })
      .limit(7);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/comment/get', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('comments_table')
      .select(`
        comment_id,
        comment_text,
        date_written,
        user_infos (username_reg, useremail_reg, useravatar_url)
      `)
      .order('date_written', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/comment/comment_id/get', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('comments_table')
      .select('comment_id')
      .order('comment_id', { ascending: false })
      .limit(1);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/comment/insert', async (req, res) => {
  const { useremail_reg, comment_text, date_written } = req.body;
  try {
    const { data, error } = await supabase
      .from('comments_table')
      .insert({ useremail_reg, comment_text, date_written });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/comment/delete/:comment_id', async (req, res) => {
  const { comment_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('comments_table')
      .delete()
      .eq('comment_id', comment_id);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reply/delete/:comment_id', async (req, res) => {
  const { comment_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('replies_table')
      .delete()
      .eq('comment_id', comment_id);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/user_reply/delete/:comment_id', async (req, res) => {
  const { comment_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('replies_table')
      .delete()
      .eq('reply_id', comment_id);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/comment/update', async (req, res) => {
  const { comment_id, comment_text } = req.body;
  try {
    const { data, error } = await supabase
      .from('comments_table')
      .update({ comment_text })
      .eq('comment_id', comment_id);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/reply/update', async (req, res) => {
  const { Reply_value, Reply_id } = req.body;
  try {
    const { data, error } = await supabase
      .from('replies_table')
      .update({ reply_content: Reply_value })
      .eq('reply_id', Reply_id);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/confirm/update', async (req, res) => {
  const { log_Email, confirm } = req.body;
  try {
    const { data, error } = await supabase
      .from('user_infos')
      .update({ confirmed: confirm })
      .eq('useremail_reg', log_Email);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reply_get', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('replies_table')
      .select(`
        reply_id,
        comment_id,
        useremail_reg,
        reply_content,
        reply_written,
        user_infos (useravatar_url, username_reg)
      `)
      .order('reply_written', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reply_insert', async (req, res) => {
  const { Reg_email, Reply_content, Reply_written, Comment_ID } = req.body;
  try {
    const { data, error } = await supabase
      .from('replies_table')
      .insert({
        useremail_reg: Reg_email,
        reply_content: Reply_content,
        reply_written: Reply_written,
        comment_id: Comment_ID
      });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/insert', async (req, res) => {
  const { Reg_email, Reg_username, Reg_password, Reg_avatar_url, confirmed, code, user_created, usergender_reg, userprogram_reg, useryear_reg } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(Reg_password, 10);
    const { data, error } = await supabase
      .from('user_infos')
      .insert({
        useremail_reg: Reg_email,
        username_reg: Reg_username,
        userpassword_reg: hashedPassword,
        useravatar_url: Reg_avatar_url,
        confirmed,
        code,
        user_created,
        usergender_reg,
        userprogram_reg,
        useryear_reg
      });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/avatar_get', async (req, res) => {
  const { Reg_email } = req.body;
  try {
    const { data, error } = await supabase
      .from('user_infos')
      .select('useravatar_url')
      .eq('useremail_reg', Reg_email)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/avatar/update', async (req, res) => {
  const { Reg_avatar_url, Reg_email } = req.body;
  try {
    const { data, error } = await supabase
      .from('user_infos')
      .update({ useravatar_url: Reg_avatar_url })
      .eq('useremail_reg', Reg_email);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sendemail', (req, res) => {
  console.log(process.env.DSA_EMAIL);
  console.log(process.env.DSA_PASS);
  const { code, email } = req.body;
  let transporter = nodemailer.createTransport({
    host: "smtp.mailersend.net",
    port: 587,
    secure: false,
    auth: {
      user: process.env.DSA_EMAIL,
      pass: process.env.DSA_PASS,
    },
    debug: true,
  });

  let info = transporter.sendMail({
    from: 'dsavisual@trial-k68zxl2yme54j905.mlsender.net',
    to: email,
    subject: "E-mail Confirmation",
    text: `Visit the link to confirm your E-mail Address: https://dsa-visualizer-client.herokuapp.com/login-form/?code=${code}&email=${email}\nAlternatively, You can use this code to confirm your E-mail Address: \n${code}`,
    html: `<b>To start using your account, you have to confirm your E-mail Address: </b><a href="https://dsa-visualizer-client.herokuapp.com/login-form/?code=${code}&email=${email}"  target="_blank">Confirm E-mail Address</a>\nCode: ${code}`,
  });

  console.log("Message sent: %s", info.messageId);
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  res.json({ message: 'Email sent successfully' });
});

// AdminPanel
app.get('/api/admin/get', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_panel')
      .select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Quiz
app.get('/api/admin/get_questions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('*')
      .order('question_id', { ascending: true });  // Add this line
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/user/get_questions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_random_questions');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/get_user_quiz_taken', async (req, res) => {
  const { Reg_email } = req.body;
  try {
    const { data, error } = await supabase
      .from('quiz_statistics')
      .select('*')
      .eq('useremail_reg', Reg_email)
      .gte('quiz_taken', new Date().toISOString().split('T')[0]);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/insert_questions', async (req, res) => {
  const { question_type, question_content, question_choices, correct_answer } = req.body;
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .insert({ question_type, question_content, question_choices, correct_answer });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/delete_question/:question_id', async (req, res) => {
  const { question_id } = req.params;
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .delete()
      .eq('question_id', question_id);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/quiz_id/get', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('question_id')
      .order('question_id', { ascending: false })
      .limit(1);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/admin/truncate_question', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('truncate_quiz_questions');
    if (error) throw error;
    res.json({ message: 'Quiz questions truncated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Gather Data for Dashboard
app.get('/api/admin/user_stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_stats');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/new_user_stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_new_user_stats');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/user_stats_comments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_stats_comments');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/user_stats_replies', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_stats_replies');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/user_stats_activity', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_stats_activity');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/user_demographic_gender', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_demographic_gender');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/user_demographic_yearlevel', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_demographic_yearlevel');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/user_demographic_program', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_demographic_program');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/comments_replies_stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_comments_replies_stats');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/comments_line_stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_comments_line_stats');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/user_stats_quiztaken', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_stats_quiztaken');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/user_stats_quizzes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_user_stats_quizzes');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/quiz_bar_stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_quiz_bar_stats');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/quiz_questions_stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_quiz_questions_stats');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/quiz_taker_stats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .rpc('get_quiz_taker_stats');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/quiz_finish', async (req, res) => {
  const { Reg_email, User_score, Q_total, Q_taken } = req.body;
  try {
    const { data, error } = await supabase
      .from('quiz_statistics')
      .insert({
        useremail_reg: Reg_email,
        user_score: User_score,
        questions_total: Q_total,
        quiz_taken: Q_taken
      });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/quiz_admin/update', async (req, res) => {
  const { question_id, question_type, question_content, question_choices, correct_answer } = req.body;
  try {
    const { data, error } = await supabase
      .from('quiz_questions')
      .update({
        question_type,
        question_content,
        question_choices,
        correct_answer
      })
      .eq('question_id', question_id);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/username/delete/:useremail', async (req, res) => {
  const { useremail } = req.params;
  try {
    const { data, error } = await supabase
      .from('user_infos')
      .delete()
      .eq('useremail_reg', useremail);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/user_comment/delete/:reg_email', async (req, res) => {
  const { reg_email } = req.params;
  try {
    const { data, error } = await supabase
      .from('comments_table')
      .delete()
      .eq('useremail_reg', reg_email);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/user_reply/delete/:reg_email', async (req, res) => {
  const { reg_email } = req.params;
  try {
    const { data, error } = await supabase
      .from('replies_table')
      .delete()
      .eq('useremail_reg', reg_email);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log("Running on port 3001");
});