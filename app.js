// app.js

// 환경 변수 로드
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const connection = require('./db');
const { sendPushNotification } = require('./websocket'); // 웹 소켓 사용 시
// const { sendPushNotification } = require('./push'); 웹 푸시 사용 시
const app = express();
const port = process.env.PORT || 3000;
// const session = require('express-session');


// 미들웨어 설정 (JSON 파싱)
app.use(express.json());


// JWT 검증 미들웨어
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// 권한 검증 미들웨어
const authorizeRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ message: 'Access denied'});
        }
    next();
    };
};


/* // 세션 검증 미들웨어
const authenticateSession = (req, res, next) => {
    if (!req.session.userId) {
        return res.sendStatus(401);
    }
    next();
};
*/


// 세션 설정
/*
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPS 사용 시 secure: true로 변경
    }));
*/

/* mysql 연결 설정 4.1 부터 .db로 이동
const mysql = require('mysql');
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err.stack);
        return;
    }
    console.log('Connected to MySQL as id', connection.threadId);
});
*/ //ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ


// 회원 가입 API
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    // 입력 값 검증
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required'})
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 데이터베이스에 저장
    connection.query('INSERT INTO Users (username, email, password VALUES (?, ?, ?)', [username, email, hashedPassword, 'user'], (err, results) => {
        if (err) {
            return res.status(500).json({error: err.message});
        }
        res.status(201).json({ message: '회원 가입 성공'});
    });
});


// 로그인 API
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // 입력 값 검증
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    // 사용자 조회
    connection.query('SELECT * FROM Users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

    // 사용자 존재 여부 확인
        if (results.length === 0 || !(await bcrypt.compare(password, results[0].password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

    // JWT 생성
        const user = results[0];
        const token = jwt.sign({ id: results[0].id, role: user.role }, process.env.JWT_SECRET, {expiresIn: '1h' });
        res.json({ token });
    });
});


// 사용자 정보 조회 API
app.get('/user', authenticateToken, (req, res) => {
    connection.query('SELECT id, username, email, role, created_at, updated_at FROM Users WHERE id = ?', [req.user.id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(results[0]);
    });
});

// 사용자 정보 수정 API
app.put('/user', authenticateToken, (req, res) => {
    const { username, email } = req.body;

    if (!username || !email) {
        return res.status(400).json({ message: 'Username and email are required' });
    }

    connection.query('UPDATE Users SET username = ?, email = ?, updated_at = NOW() WHERE id = ?', [username, email, req.user.id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'User updated successfully'});
    });
});

// 사용자 정보 삭제 API
app.delete('/user', authenticateToken, (req, res) => {
    connection.query('DELETE FROM Users WHERE id = ?', [req.user.id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'User deleted successfully'});
    });
});


// 비밀번호 변경 API
app.put('/user/password', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Old password and new password are required' });
    }

    connection.query('SELECT password FROM Users WHERE id = ?', [req.user.id], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Old password is incorrect' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        connection.query('UPDATE Users SET password = ?, update_at = NOW() WHERE id = ?', [hashedNewPassword, req.user.id], (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Password updated successfully' });
        });
    });
});

// 반려동물 등록 API
app.post('/pets', authenticateToken, (req, res) => {
    const { name, type, breed, age } = req.body;
    const userId = req.user.id;
  
    if (!name || !type) {
      return res.status(400).json({ message: 'Name and type are required' });
    }
  
    connection.query('INSERT INTO Pets (user_id, name, type, breed, age) VALUES (?, ?, ?, ?, ?)', [userId, name, type, breed, age], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: 'Pet registered successfully!' });
    });
  });


// 반려동물 수정 API
app.put('/pets/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { name, type, breed, age } = req.body;
    const userId = req.user.id;

    connection.query('UPDATE Pets SET name = ?, type = ?, breed = ?, age = ?, updated_at = NOW() WHERE id = ? AND user_id = ?', [name, type, breed, age, id, userId], (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (results.affectedRows === 0) {
          return res.status(404).json({ message: 'Pet not found or unauthorized' });
        }
        res.json({ message: 'Pet updated successfully' });
    });
});


// 반려동물 삭제 API
app.delete('/pets/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
  
    connection.query('DELETE FROM Pets WHERE id = ? AND user_id = ?', [id, userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.affectedRows === 0) {
            return res.status(404).json({ message: 'Pet not found or unauthorized' });
        }
        res.json({ message: 'Pet deleted successfully' });
    });
});
  
// 반려동물 목록 조회 API
app.get('/pets', authenticateToken, (req, res) => {
    const userId = req.user.id;
  
    connection.query('SELECT id, name, type, breed, age, created_at, updated_at FROM Pets WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
         return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});





// 기본 라우트
app.get('/', (req, res) => {
    res.send('Hello world!');
});

// 보호된 라우트 (일반 유저)ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
app.get('/user', authenticateToken, (req, res) => {
    res.json({ message: 'This is a protected route for users', user: req.user});
});

/* 3.2 까지 사용
app.get('protected', authenticateToken, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});
*/ //ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ


// 보호된 라우트 (관리자)ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ
app.get('/admin', authenticateToken, authorizeRole('admin'),  (req, res) => {
    res.json({ message: 'This is a protected route for admin', user: req.user});
});

/* 3.2 까지 사용
app.get('protected', authenticateToken, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});
*/ //ㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡㅡ

// 게시글 작성 API
app.post('/posts', authenticateToken, (req, res) => {
    const { title, content } = req.body;
    const userId = req.user.id;
  
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
  
    connection.query('INSERT INTO Posts (user_id, title, content) VALUES (?, ?, ?)', [userId, title, content], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: 'Post created successfully!' });
    });
  });
  
  // 게시글 목록 조회 API
  app.get('/posts', (req, res) => {
    connection.query('SELECT Posts.id, Posts.title, Posts.content, Posts.created_at, Posts.updated_at, Users.username FROM Posts JOIN Users ON Posts.user_id = Users.id', (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  });
  
  // 게시글 조회 API
  app.get('/posts/:id', (req, res) => {
    const { id } = req.params;
  
    connection.query('SELECT Posts.id, Posts.title, Posts.content, Posts.created_at, Posts.updated_at, Users.username FROM Posts JOIN Users ON Posts.user_id = Users.id WHERE Posts.id = ?', [id], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.length === 0) {
        return res.status(404).json({ message: 'Post not found' });
      }
      res.json(results[0]);
    });
  });
  
  // 게시글 수정 API
  app.put('/posts/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const userId = req.user.id;
  
    connection.query('UPDATE Posts SET title = ?, content = ?, updated_at = NOW() WHERE id = ? AND user_id = ?', [title, content, id, userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: 'Post not found or unauthorized' });
      }
      res.json({ message: 'Post updated successfully' });
    });
  });
  
  // 게시글 삭제 API
  app.delete('/posts/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
  
    connection.query('DELETE FROM Posts WHERE id = ? AND user_id = ?', [id, userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: 'Post not found or unauthorized' });
      }
      res.json({ message: 'Post deleted successfully' });
    });
  });
  

// 댓글 작성 API
app.post('/comments', authenticateToken, (req, res) => {
    const { postId, content } = req.body;
    const userId = req.user.id;
  
    if (!postId || !content) {
      return res.status(400).json({ message: 'Post ID and content are required' });
    }
  
    connection.query('INSERT INTO Comments (post_id, user_id, content) VALUES (?, ?, ?)', [postId, userId, content], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

    /* // (웹 푸시 사용시) 게시글 작성자의 푸시 구독 정보를 가져와서 푸시 알림 전송
        connection.query('SELECT subscription FROM Users WHERE id = (SELECT user_id FROM Posts WHERE id = ?)', [postId], (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (results.length > 0) {
                const subscription = JSON.parse(results[0].subscription);
                const data = {
                    title: 'New Comment on Your Post',
                    body: `A new comment has been added to your post. Comment: ${content}`
                };
                sendPushNotification(subscription, data);
            }
        });
        */
    
    // 게시글 작성자의 ID를 가져와서 웹소켓 알림 전송
    connection.query('SELECT user_id FROM Posts WHERE id = ?', [postId], (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (results.length > 0) {
          const postAuthorId = results[0].user_id;
          const data = {
            message: 'New Comment on Your Post',
            comment: content
          };
          sendWebSocketNotification(postAuthorId, data);
        }
      });

      res.status(201).json({ message: 'Comment created successfully!' });
    });
  });
  

  // 댓글 목록 조회 API
  app.get('/posts/:postId/comments', (req, res) => {
    const { postId } = req.params;
  
    connection.query('SELECT Comments.id, Comments.content, Comments.created_at, Comments.updated_at, Users.username FROM Comments JOIN Users ON Comments.user_id = Users.id WHERE Comments.post_id = ?', [postId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  });
  
  // 댓글 수정 API
  app.put('/comments/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
  
    connection.query('UPDATE Comments SET content = ?, updated_at = NOW() WHERE id = ? AND user_id = ?', [content, id, userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: 'Comment not found or unauthorized' });
      }
      res.json({ message: 'Comment updated successfully' });
    });
  });
  
  // 댓글 삭제 API
  app.delete('/comments/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
  
    connection.query('DELETE FROM Comments WHERE id = ? AND user_id = ?', [id, userId], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (results.affectedRows === 0) {
        return res.status(404).json({ message: 'Comment not found or unauthorized' });
      }
      res.json({ message: 'Comment deleted successfully' });
    });
  });
  


// 서버 시작
app.listen(port, () => {
    console.log(`서버 작동 중 주소 http://localhost:${port}`);
});