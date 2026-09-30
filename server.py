import os
from datetime import datetime
from functools import wraps
from flask import Flask, flash, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from PIL import Image
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///journal.db'
app.config['SECRET_KEY'] = 'kunci-rahasia-anda'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Max 16MB

db = SQLAlchemy(app)

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


class Profile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    bio = db.Column(db.Text, nullable=False)
    email = db.Column(db.String(100), nullable=False)


class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False, default='Jurnal Harian')
    image_file = db.Column(db.String(100), nullable=True)
    # PERBAIKAN: Gunakan datetime.now untuk Python 3.14+
    date_posted = db.Column(db.DateTime, nullable=False, default=datetime.now)
    comments = db.relationship(
        'Comment', backref='post', lazy=True, cascade='all, delete-orphan'
    )


class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    author = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    # PERBAIKAN: Gunakan datetime.now
    date_posted = db.Column(db.DateTime, nullable=False, default=datetime.now)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)


class ContactMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    message = db.Column(db.Text, nullable=False)
    # PERBAIKAN: Gunakan datetime.now
    date_posted = db.Column(db.DateTime, nullable=False, default=datetime.now)


with app.app_context():
    db.create_all()
    if not Profile.query.first():
        default_profile = Profile(
            name='Baros',
            bio=(
                'Halo! Ini adalah personal journal & web blog tempat saya'
                ' membagikan cerita, catatan harian, dan artikel menarik.'
            ),
            email='anda@email.com',
        )
        db.session.add(default_profile)
        db.session.commit()


def save_and_compress_image(form_picture):
    random_hex = os.urandom(8).hex()
    _, f_ext = os.path.splitext(form_picture.filename)
    picture_fn = random_hex + f_ext
    picture_path = os.path.join(app.config['UPLOAD_FOLDER'], picture_fn)

    output_size = (800, 800)
    img = Image.open(form_picture)
    img.thumbnail(output_size)
    img.save(picture_path, quality=85, optimize=True)

    return picture_fn


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            flash('Silakan login terlebih dahulu sebagai Admin.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)

    return decorated_function


@app.route('/')
def index():
    page = request.args.get('page', 1, type=int)
    per_page = 5
    offset_val = (page - 1) * per_page

    posts = (
        Post.query.order_by(Post.date_posted.desc())
        .limit(per_page)
        .offset(offset_val)
        .all()
    )

    total_posts = Post.query.count()
    has_next = (offset_val + per_page) < total_posts
    has_prev = page > 1

    class PaginationObj:
        def __init__(self, page, has_next, has_prev):
            self.page = page
            self.has_next = has_next
            self.has_prev = has_prev
            self.next_num = page + 1
            self.prev_num = page - 1

    pagination = PaginationObj(page, has_next, has_prev)

    return render_template('index.html', posts=posts, pagination=pagination)


@app.route('/about', methods=['GET', 'POST'])
def about():
    profile = Profile.query.first()
    if request.method == 'POST':
        if not session.get('logged_in'):
            flash('Hanya admin yang dapat mengubah profil.', 'danger')
            return redirect(url_for('about'))
        profile.name = request.form['name']
        profile.email = request.form['email']
        profile.bio = request.form['bio']
        db.session.commit()
        flash('Profil berhasil diperbarui!', 'success')
        return redirect(url_for('about'))
    return render_template('about.html', profile=profile)


@app.route('/admin/messages')
@login_required
def admin_messages():
    messages = ContactMessage.query.order_by(ContactMessage.date_posted.desc()).all()
    return render_template('admin_messages.html', messages=messages)


@app.route('/admin/message/<int:msg_id>/delete', methods=['POST'])
@login_required
def delete_message(msg_id):
    msg = ContactMessage.query.get_or_404(msg_id)
    db.session.delete(msg)
    db.session.commit()
    flash('Pesan berhasil dihapus!', 'success')
    return redirect(url_for('admin_messages'))


@app.route('/new', methods=['GET', 'POST'])
@login_required
def new_post():
    if request.method == 'POST':
        title = request.form['title']
        content = request.form['content']
        category = request.form['category']
        image_file = None

        if not title or not content:
            flash('Judul dan konten tidak boleh kosong!', 'danger')
            return redirect(url_for('new_post'))

        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename != '':
                image_file = save_and_compress_image(file)

        new_entry = Post(
            title=title, content=content, category=category, image_file=image_file
        )
        db.session.add(new_entry)
        db.session.commit()
        flash('Jurnal/Blog berhasil ditambahkan!', 'success')
        return redirect(url_for('index'))

    return render_template('new.html')


@app.route('/post/<int:post_id>/edit', methods=['GET', 'POST'])
@login_required
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

        if 'image' in request.files:
            file = request.files['image']
            if file and file.filename != '':
                post.image_file = save_and_compress_image(file)

        db.session.commit()
        flash('Jurnal/Blog berhasil diperbarui!', 'success')
        return redirect(url_for('index'))

    return render_template('edit.html', post=post)


@app.route('/post/<int:post_id>/delete', methods=['POST'])
@login_required
def delete_post(post_id):
    post = Post.query.get_or_404(post_id)
    db.session.delete(post)
    db.session.commit()
    flash('Jurnal/Blog berhasil dihapus!', 'success')
    return redirect(url_for('index'))


@app.route('/kontak', methods=['GET', 'POST'])
def kontak():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        message = request.form['message']

        if not name or not email or not message:
            flash('Semua kolom wajib diisi!', 'danger')
            return redirect(url_for('kontak'))

        new_message = ContactMessage(name=name, email=email, message=message)
        db.session.add(new_message)
        db.session.commit()
        flash('Pesan Anda berhasil dikirim!', 'success')
        return redirect(url_for('kontak'))

    return render_template('kontak.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if username == 'admin' and password == 'admin123':
            session['logged_in'] = True
            flash('Berhasil login sebagai Admin!', 'success')
            return redirect(url_for('index'))
        else:
            flash('Username atau Password salah!', 'danger')
            return redirect(url_for('login'))

    return render_template('login.html')


@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    flash('Anda telah logout.', 'info')
    return redirect(url_for('index'))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
