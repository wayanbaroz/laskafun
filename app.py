from datetime import datetime
from flask import Flask, flash, redirect, render_template, request, url_for
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///journal.db'
app.config['SECRET_KEY'] = 'kunci-rahasia-anda'
db = SQLAlchemy(app)


# Model Biodata
class Profile(db.Model):
  id = db.Column(db.Integer, primary_key=True)
  name = db.Column(db.String(100), nullable=False)
  bio = db.Column(db.Text, nullable=False)
  email = db.Column(db.String(100), nullable=False)


# Model Postingan Blog/Jurnal
class Post(db.Model):
  id = db.Column(db.Integer, primary_key=True)
  title = db.Column(db.String(100), nullable=False)
  content = db.Column(db.Text, nullable=False)
  category = db.Column(
      db.String(50), nullable=False, default='Jurnal Harian'
  )  # Kategori / Kategori Foto
  date_posted = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
  comments = db.relationship(
      'Comment', backref='post', lazy=True, cascade='all, delete-orphan'
  )


# Model Komentar
class Comment(db.Model):
  id = db.Column(db.Integer, primary_key=True)
  author = db.Column(db.String(50), nullable=False)
  content = db.Column(db.Text, nullable=False)
  date_posted = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
  post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)


# Model Pesan Kontak
class ContactMessage(db.Model):
  id = db.Column(db.Integer, primary_key=True)
  name = db.Column(db.String(50), nullable=False)
  email = db.Column(db.String(100), nullable=False)
  message = db.Column(db.Text, nullable=False)
  date_posted = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


with app.app_context():
  db.create_all()
  # Buat profil default jika belum ada
  if not Profile.query.first():
    default_profile = Profile(
        name='Nama Anda',
        bio=(
            'Halo! Ini adalah personal journal & web blog tempat saya'
            ' membagikan cerita, catatan harian, dan artikel menarik.'
        ),
        email='anda@email.com',
    )
    db.session.add(default_profile)
    db.session.commit()


@app.route('/')
def index():
  page = request.args.get('page', 1, type=int)
  view_mode = request.args.get('view', 'full', type=str)
  selected_category = request.args.get('category', '', type=str)

  query = Post.query.order_by(Post.date_posted.desc())
  if selected_category:
    query = query.filter_by(category=selected_category)

  pagination = query.paginate(page=page, per_page=5)
  posts = pagination.items

  # Ambil daftar kategori unik untuk filter
  categories = db.session.query(Post.category.distinct()).all()
  categories = [c[0] for c in categories]

  return render_template(
      'index.html',
      posts=posts,
      pagination=pagination,
      view_mode=view_mode,
      categories=categories,
      selected_category=selected_category,
  )


@app.route('/tag/<string:tag>')
def posts_by_tag(tag):
  page = request.args.get('page', 1, type=int)
  search_tag = f'#{tag}'
  pagination = (
      Post.query.filter(Post.content.like(f'%{search_tag}%') | Post.title.like(f'%{search_tag}%'))
      .order_by(Post.date_posted.desc())
      .paginate(page=page, per_page=5)
  )
  posts = pagination.items
  return render_template(
      'tag.html', posts=posts, pagination=pagination, tag=tag
  )


@app.route('/post/<int:post_id>', methods=['GET', 'POST'])
def post(post_id):
  post = Post.query.get_or_404(post_id)
  if request.method == 'POST':
    author = request.form['author']
    content = request.form['content']

    if not author or not content:
      flash('Nama dan komentar tidak boleh kosong!', 'danger')
      return redirect(url_for('post', post_id=post.id))

    new_comment = Comment(author=author, content=content, post_id=post.id)
    db.session.add(new_comment)
    db.session.commit()
    flash('Komentar berhasil ditambahkan!', 'success')
    return redirect(url_for('post', post_id=post.id))

  return render_template('post.html', post=post)


@app.route('/new', methods=['GET', 'POST'])
def new_post():
  if request.method == 'POST':
    title = request.form['title']
    content = request.form['content']
    category = request.form['category']

    if not title or not content:
      flash('Judul dan konten tidak boleh kosong!', 'danger')
      return redirect(url_for('new_post'))

    new_entry = Post(title=title, content=content, category=category)
    db.session.add(new_entry)
    db.session.commit()
    flash('Jurnal/Blog berhasil ditambahkan!', 'success')
    return redirect(url_for('index'))

  return render_template('new.html')


@app.route('/post/<int:post_id>/edit', methods=['GET', 'POST'])
def edit_post(post_id):
  post = Post.query.get_or_404(post_id)
  if request.method == 'POST':
    title = request.form['title']
    content = request.form['content']
    category = request.form['category']

    if not title or not content:
      flash('Judul dan konten tidak boleh kosong!', 'danger')
      return redirect(url_for('edit_post', post_id=post.id))

    post.title = title
    post.content = content
    post.category = category
    db.session.commit()
    flash('Jurnal/Blog berhasil diperbarui!', 'success')
    return redirect(url_for('post', post_id=post.id))

  return render_template('edit.html', post=post)


@app.route('/post/<int:post_id>/delete', methods=['POST'])
def delete_post(post_id):
  post = Post.query.get_or_404(post_id)
  db.session.delete(post)
  db.session.commit()
  flash('Jurnal/Blog berhasil dihapus!', 'success')
  return redirect(url_for('index'))


@app.route('/about', methods=['GET', 'POST'])
def about():
  profile = Profile.query.first()
  if request.method == 'POST':
    profile.name = request.form['name']
    profile.bio = request.form['bio']
    profile.email = request.form['email']
    db.session.commit()
    flash('Biodata berhasil diperbarui!', 'success')
    return redirect(url_for('about'))
  return render_template('about.html', profile=profile)


@app.route('/contact', methods=['GET', 'POST'])
def contact():
  if request.method == 'POST':
    name = request.form['name']
    email = request.form['email']
    message = request.form['message']

    if not name or not email or not message:
      flash('Semua kolom wajib diisi!', 'danger')
      return redirect(url_for('contact'))

    new_message = ContactMessage(name=name, email=email, message=message)
    db.session.add(new_message)
    db.session.commit()
    flash('Pesan Anda berhasil dikirim!', 'success')
    return redirect(url_for('contact'))

  return render_template('contact.html')


@app.route('/admin/messages')
def admin_messages():
  messages = ContactMessage.query.order_by(
      ContactMessage.date_posted.desc()
  ).all()
  return render_template('admin_messages.html', messages=messages)


@app.route('/admin/messages/<int:msg_id>/delete', methods=['POST'])
def delete_message(msg_id):
  message = ContactMessage.query.get_or_404(msg_id)
  db.session.delete(message)
  db.session.commit()
  flash('Pesan berhasil dihapus!', 'success')
  return redirect(url_for('admin_messages'))


import os

if __name__ == '__main__':
    # Membaca port dinamis dari Railway, jika tidak ada (lokal) pakai port 5000
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
