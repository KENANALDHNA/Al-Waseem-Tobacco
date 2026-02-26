import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('prices.db');

function initDb() {
  // Initialize Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      cost_usd REAL DEFAULT 0,
      profit_syp REAL DEFAULT 500,
      wholesale_profit_syp REAL DEFAULT 250,
      carton_usd REAL DEFAULT 0,
      wholesale_carton_usd REAL DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migration: Add new columns if they don't exist
  try { db.exec('ALTER TABLE products ADD COLUMN cost_usd REAL DEFAULT 0'); } catch (e) { /* ignore */ }
  try { db.exec('ALTER TABLE products ADD COLUMN profit_syp REAL DEFAULT 500'); } catch (e) { /* ignore */ }
  try { db.exec('ALTER TABLE products ADD COLUMN wholesale_profit_syp REAL DEFAULT 250'); } catch (e) { /* ignore */ }
  try { db.exec('ALTER TABLE products ADD COLUMN wholesale_carton_usd REAL DEFAULT 0'); } catch (e) { /* ignore */ }

  // Sync cost_usd with carton_usd for existing data if cost_usd is 0 or NULL
  db.prepare('UPDATE products SET cost_usd = carton_usd WHERE (cost_usd = 0 OR cost_usd IS NULL) AND carton_usd > 0').run();

  // Seed initial settings if empty
  const globalRateSetting = db.prepare('SELECT * FROM settings WHERE key = ?').get('global_rate') as any;
  if (!globalRateSetting) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('global_rate', '11700');
  }

  // Seed initial categories if empty
  const categoryCount = db.prepare('SELECT count(*) as count FROM categories').get() as { count: number };
  if (categoryCount.count === 0) {
    const insertCategory = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
    const categoryNames = [
      'عام', '1970', 'اليغانس', 'ماستر', 'كينغ دوم', 'كابتن بلاك', 
      'روز', 'مالبو', 'اوسكار', 'مشكل', 'أن أن تركي', 'تي أس', 
      'مانشستر', 'بلاتينيوم', 'غلواز', 'معسل', 'فحم', 'فيب', 'قداحات', 'اركيلة'
    ];
    
    const insertProduct = db.prepare('INSERT INTO products (category_id, name, carton_usd, wholesale_carton_usd) VALUES (?, ?, ?, ?)');

    const seedTransaction = db.transaction(() => {
      categoryNames.forEach((cat, index) => insertCategory.run(cat, index));

      const cats = db.prepare('SELECT * FROM categories').all() as any[];
      const getCatId = (name: string) => cats.find(c => c.name === name)?.id || 1;

      const productsToSeed = [
        // عام
        { cat: 'عام', name: 'مالبورو ابيض كرتون حرة الاصلي', usd: 22.56, wholesale: 22.30 },
        { cat: 'عام', name: 'مالبورو احمر كرتون حرة الاصلي', usd: 24.61, wholesale: 24.60 },
        { cat: 'عام', name: 'مالبورو كرتون سلفر بلو حرة', usd: 0, wholesale: 0 },
        { cat: 'عام', name: 'مالبورو فقسات دبل فيوجن دبل ميكس', usd: 21.36, wholesale: 21.00 },
        { cat: 'عام', name: 'مالبورو 3 فقسات قصير + سول شافل', usd: 21.36, wholesale: 21.00 },
        { cat: 'عام', name: 'دافيدووف سليم ابيض دهبي خمري', usd: 14.52, wholesale: 14.30 },
        { cat: 'عام', name: 'ونستون قصير ازرق و فضي حرة', usd: 14.82, wholesale: 14.50 },
        
        // 1970
        { cat: '1970', name: '1970ازرق طویل شركة', usd: 4.74, wholesale: 4.70 },
        { cat: '1970', name: '1970 فضي طويل شركة', usd: 4.74, wholesale: 4.70 },
        { cat: '1970', name: '1970ازرق قصیر', usd: 4.31, wholesale: 4.30 },
        { cat: '1970', name: '1970 قصير فضي', usd: 3.93, wholesale: 4.00 },
        { cat: '1970', name: '1970اورجینال قصیر', usd: 3.24, wholesale: 3.30 },
        { cat: '1970', name: '1970 كوين اسود', usd: 4.52, wholesale: 0 },
        { cat: '1970', name: '1970 كوين ازرق', usd: 4.44, wholesale: 4.50 },
        { cat: '1970', name: '1970أبیض كوین', usd: 4.18, wholesale: 4.20 },
        { cat: '1970', name: '1970 سليم فضي', usd: 3.46, wholesale: 3.46 },
        { cat: '1970', name: '1970نعنع سلیم', usd: 4.10, wholesale: 4.10 },
        { cat: '1970', name: '1970 سليم أزرق', usd: 3.24, wholesale: 3.20 },

        // اليغانس
        { cat: 'اليغانس', name: 'الیغانس طویل فضي', usd: 4.44, wholesale: 4.40 },
        { cat: 'اليغانس', name: 'الیغانس طویل فضي مخصص', usd: 6.79, wholesale: 7.00 },
        { cat: 'اليغانس', name: 'اليغانس طويل اسود', usd: 4.95, wholesale: 4.90 },
        { cat: 'اليغانس', name: 'الیغانس طویل ابیض مخصص', usd: 4.52, wholesale: 4.40 },
        { cat: 'اليغانس', name: 'الیغانس قصیر فضي مخصص', usd: 5.38, wholesale: 0 },
        { cat: 'اليغانس', name: 'اليغانس قصير فضي غير مخصص', usd: 4.44, wholesale: 4.04 },
        { cat: 'اليغانس', name: 'اليغانس قصير اسود مخصص', usd: 4.35, wholesale: 4.36 },
        { cat: 'اليغانس', name: 'الیغانس كوین أزرق مخصص شركة', usd: 3.37, wholesale: 3.40 },
        { cat: 'اليغانس', name: 'الیغانس كوین أبیض مخصص شركة', usd: 3.37, wholesale: 3.40 },
        { cat: 'اليغانس', name: 'الیغانس سليم ازرق جديد', usd: 2.86, wholesale: 2.86 },
        { cat: 'اليغانس', name: 'الیغانس سليم فضي جديد', usd: 2.94, wholesale: 2.90 },
        { cat: 'اليغانس', name: 'الیغانس سليم فضي قدیم طبعة مخصص', usd: 4.05, wholesale: 4.00 },
        { cat: 'اليغانس', name: 'اليغانس سليم ازرق قديم طبعة', usd: 3.58, wholesale: 3.60 },
        { cat: 'اليغانس', name: 'اليغانس سليم دهبي غولد', usd: 3.46, wholesale: 3.50 },
        { cat: 'اليغانس', name: 'الیغانس قصیر فقستين', usd: 5.38, wholesale: 5.06 },
        { cat: 'اليغانس', name: 'اليغانس كوين فقسة', usd: 4.14, wholesale: 4.16 },
        { cat: 'اليغانس', name: 'الیغانس سليم نعنع قديم', usd: 3.58, wholesale: 3.60 },

        // ماستر
        { cat: 'ماستر', name: 'ماستر طویل أزرق', usd: 5.55, wholesale: 5.56 },
        { cat: 'ماستر', name: 'ماستر قصیر أزرق', usd: 4.95, wholesale: 5.00 },
        { cat: 'ماستر', name: 'ماستر قصير فضي', usd: 4.95, wholesale: 5.00 },
        { cat: 'ماستر', name: 'ماستر كوین أبیض', usd: 6.45, wholesale: 8.00 },
        { cat: 'ماستر', name: 'ماستر كوين ازرق', usd: 6.58, wholesale: 8.60 },
        { cat: 'ماستر', name: 'ماستر سليم فضي', usd: 5.12, wholesale: 5.10 },
        { cat: 'ماستر', name: 'ماستر سليم ازرق', usd: 5.12, wholesale: 5.10 },

        // كينغ دوم
        { cat: 'كينغ دوم', name: 'كينغ دوم طویل فضي مخصص شركة', usd: 4.74, wholesale: 4.74 },
        { cat: 'كينغ دوم', name: 'كينغ دوم قصير فضي دهبي احمر', usd: 4.35, wholesale: 4.32 },
        { cat: 'كينغ دوم', name: 'كينغ دوم كوین أبیض مخصص شركة', usd: 4.14, wholesale: 4.30 },
        { cat: 'كينغ دوم', name: 'كينغ دوم سليم أبيض مخصص شركة', usd: 3.54, wholesale: 3.54 },
        { cat: 'كينغ دوم', name: 'كينغ دوم سليم نعنع', usd: 4.10, wholesale: 3.66 },

        // كابتن بلاك
        { cat: 'كابتن بلاك', name: 'كابتن بلاك سليم سكاي', usd: 3.24, wholesale: 3.26 },
        { cat: 'كابتن بلاك', name: 'كابتن بلاك سليم سلفر', usd: 3.24, wholesale: 3.26 },
        { cat: 'كابتن بلاك', name: 'كابتن بلاك كوين ابيض one', usd: 3.93, wholesale: 3.96 },
        { cat: 'كابتن بلاك', name: 'كابتن بلاك كوین ذھبي', usd: 4.52, wholesale: 4.52 },
        { cat: 'كابتن بلاك', name: 'كابتن بلاك طويل شوكولا', usd: 11.92, wholesale: 11.84 },
        { cat: 'كابتن بلاك', name: 'كابتن بلاك سليم ذھبي', usd: 3.84, wholesale: 3.86 },

        // روز
        { cat: 'روز', name: 'روز طویل فضي', usd: 4.10, wholesale: 4.16 },
        { cat: 'روز', name: 'روز طویل أزرق', usd: 4.05, wholesale: 4.16 },

        // مالبو
        { cat: 'مالبو', name: 'مالبو طویل أزرق', usd: 3.97, wholesale: 3.96 },
        { cat: 'مالبو', name: 'مالبو طويل فضي', usd: 3.97, wholesale: 3.96 },
        { cat: 'مالبو', name: 'مالبو كوين فضي', usd: 3.76, wholesale: 0 },

        // اوسكار
        { cat: 'اوسكار', name: 'اوسكار طویل فضي', usd: 4.52, wholesale: 4.60 },
        { cat: 'اوسكار', name: ' اوسكارسليم فضي', usd: 3.88, wholesale: 3.92 },

        // مشكل
        { cat: 'مشكل', name: 'ميلانو كوين فضي ازرق اسود', usd: 2.86, wholesale: 2.84 },
        { cat: 'مشكل', name: 'ميلانو سليم فضي ابيض ازرق', usd: 2.86, wholesale: 2.84 },
        { cat: 'مشكل', name: 'بزنس رويال طويل فضي احمر ازرق', usd: 2.86, wholesale: 2.90 },
        { cat: 'مشكل', name: 'اوريس طقتين (بلوبيري)', usd: 5.00, wholesale: 5.00 },
        { cat: 'مشكل', name: 'اوريس بلس أزرق (طقة)', usd: 4.35, wholesale: 4.32 },
        { cat: 'مشكل', name: ' اوريس توت طقة', usd: 4.35, wholesale: 4.32 },
        { cat: 'مشكل', name: 'اوريس طقة منغا', usd: 4.35, wholesale: 4.32 },
        { cat: 'مشكل', name: 'اوريس شوكولا', usd: 4.35, wholesale: 4.32 },
        { cat: 'مشكل', name: 'اوريس تشكلش علكة ونعنع', usd: 3.97, wholesale: 4.10 },
        { cat: 'مشكل', name: 'اوريس كوين شوكولا', usd: 4.65, wholesale: 4.70 },
        { cat: 'مشكل', name: 'دنفر كوين', usd: 4.52, wholesale: 4.56 },
        { cat: 'مشكل', name: 'مليونير طويل فضي و ازرق', usd: 3.54, wholesale: 3.56 },
        { cat: 'مشكل', name: 'ويلسون احمر', usd: 3.58, wholesale: 3.60 },
        { cat: 'مشكل', name: 'ويلسون فضي', usd: 3.58, wholesale: 3.60 },
        { cat: 'مشكل', name: 'اختمار سليم فضي', usd: 4.74, wholesale: 4.80 },
        { cat: 'مشكل', name: 'جيتان قصير فرنسي', usd: 8.29, wholesale: 8.30 },
        { cat: 'مشكل', name: 'مادوكس كوين اسود', usd: 3.84, wholesale: 3.86 },
        { cat: 'مشكل', name: 'برو طويل فضي', usd: 0, wholesale: 0 },
        { cat: 'مشكل', name: 'سيدرز قصير فضي شركة', usd: 6.45, wholesale: 6.60 },
        { cat: 'مشكل', name: 'سيدرز طويل فضي شركة', usd: 7.56, wholesale: 7.80 },
        { cat: 'مشكل', name: 'سيدرز طويل ازرق', usd: 7.43, wholesale: 7.50 },
        { cat: 'مشكل', name: 'يونايتد طويل اجنبي', usd: 4.74, wholesale: 4.80 },
        { cat: 'مشكل', name: ' يونايتد طويل مخصص', usd: 4.35, wholesale: 4.36 },

        // أن أن تركي
        { cat: 'أن أن تركي', name: 'ان ان طویل أزرق + فضي', usd: 3.63, wholesale: 3.64 },
        { cat: 'أن أن تركي', name: 'ان ان كوين ابیض + فضي', usd: 3.37, wholesale: 3.40 },
        { cat: 'أن أن تركي', name: 'بارسا كوين', usd: 3.80, wholesale: 3.80 },

        // تي أس
        { cat: 'تي أس', name: 'تي أس طویل فضي', usd: 3.20, wholesale: 3.20 },
        { cat: 'تي أس', name: 'تي أس طویل أزرق', usd: 3.20, wholesale: 3.16 },

        // مانشستر
        { cat: 'مانشستر', name: 'مانشستر طويل أحمر', usd: 3.63, wholesale: 3.60 },
        { cat: 'مانشستر', name: ' مانشستر طويل أزرق وفضي', usd: 3.84, wholesale: 3.80 },
        { cat: 'مانشستر', name: 'مانشستر قصير ازرق', usd: 4.35, wholesale: 4.30 },
        { cat: 'مانشستر', name: ' مانشسترقصیر فضي', usd: 3.33, wholesale: 3.40 },
        { cat: 'مانشستر', name: 'مانشستر قصير طقتين', usd: 5.72, wholesale: 5.80 },
        { cat: 'مانشستر', name: 'مانشستر سليم (نكهات)', usd: 3.16, wholesale: 3.30 },

        // بلاتينيوم
        { cat: 'بلاتينيوم', name: 'بلاتينيوم طويل فضي', usd: 3.07, wholesale: 3.12 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم طويل أزرق', usd: 3.07, wholesale: 3.12 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم سليم فضي', usd: 0, wholesale: 2.94 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم سليم أزرق', usd: 0, wholesale: 2.94 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم سليم نعنع', usd: 0, wholesale: 3.24 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم كوول طقة', usd: 0, wholesale: 3.64 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم سليم فقستين', usd: 0, wholesale: 4.44 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم سليم فقسة', usd: 0, wholesale: 3.64 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم كوين', usd: 0, wholesale: 3.14 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم كوين فقستين', usd: 0, wholesale: 4.64 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم كوين فقسة', usd: 0, wholesale: 3.84 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم قصير فقستين', usd: 0, wholesale: 5.64 },
        { cat: 'بلاتينيوم', name: 'بلاتينيوم قصير ازرق وفضي', usd: 0, wholesale: 3.54 },

        // غلواز
        { cat: 'غلواز', name: 'غلواز قصير احمر', usd: 6.53, wholesale: 6.56 },
        { cat: 'غلواز', name: 'غلواز قصير اصفر', usd: 6.53, wholesale: 6.56 },
        { cat: 'غلواز', name: 'غلواز كوين احمر S8', usd: 6.62, wholesale: 6.70 },
        { cat: 'غلواز', name: 'غلواز كوين اصفر S8', usd: 6.62, wholesale: 6.70 },

        // معسل
        { cat: 'معسل', name: 'فاخر اسود 250 غ شركة', usd: 6.11, wholesale: 6.00 },
        { cat: 'معسل', name: 'فاخر اسود 1 كغ شركة', usd: 24.01, wholesale: 24.00 },
        { cat: 'معسل', name: 'فاخر اسود 250 غ حرة دبي', usd: 5.69, wholesale: 5.63 },
        { cat: 'معسل', name: 'فاخر اسود كيلو حرة دبي مكفول', usd: 24.01, wholesale: 22.50 },
        { cat: 'معسل', name: 'فاخر تفاحتین عادي', usd: 11.32, wholesale: 11.50 },
        { cat: 'معسل', name: 'فاخر اسود 100 غ', usd: 1.62, wholesale: 1.55 },
        { cat: 'معسل', name: 'نخلة 100 غ', usd: 1.75, wholesale: 1.67 },
        { cat: 'معسل', name: 'فاخر تفاحتین أسود كروز شركة', usd: 11.32, wholesale: 11.50 },
        { cat: 'معسل', name: 'فاخر تفاح اسود متلج', usd: 11.75, wholesale: 11.92 },
        { cat: 'معسل', name: 'فاخر تفاحتين متلج', usd: 11.75, wholesale: 11.92 },
        { cat: 'معسل', name: 'مزایا تفاحتین فرنسي', usd: 8.50, wholesale: 8.50 },
        { cat: 'معسل', name: 'مزایا تفاحتین بحریني', usd: 8.50, wholesale: 8.50 },
        { cat: 'معسل', name: 'مزايا تفاح مصري', usd: 8.50, wholesale: 8.50 },
        { cat: 'معسل', name: 'مزايا بحريني كيلو', usd: 16.32, wholesale: 16.66 },
        { cat: 'معسل', name: 'مزايا كف بحريني تاريخ', usd: 4.18, wholesale: 4.09 },
        { cat: 'معسل', name: ' مزايا بولو', usd: 8.50, wholesale: 8.50 },
        { cat: 'معسل', name: 'مزايا علكة', usd: 8.50, wholesale: 8.50 },
        { cat: 'معسل', name: 'مزايا لولف', usd: 8.50, wholesale: 8.50 },
        { cat: 'معسل', name: 'مزايا روبي كراش', usd: 8.84, wholesale: 8.83 },
        { cat: 'معسل', name: 'مزايا علكة ونعنع', usd: 8.50, wholesale: 8.50 },
        { cat: 'معسل', name: 'مزايا نعنع', usd: 8.50, wholesale: 8.50 },
        { cat: 'معسل', name: 'یامال الشام مشكل', usd: 3.41, wholesale: 3.33 },
        { cat: 'معسل', name: 'معسل روز تفاحتین', usd: 0, wholesale: 0 },
        { cat: 'معسل', name: ' نخلة كروز صلاحية شهر 1/26', usd: 16.83, wholesale: 17.20 },
        { cat: 'معسل', name: 'معسل نخلة كف صلاحیة شهر 1/26', usd: 7.99, wholesale: 8.00 },

        // فحم
        { cat: 'فحم', name: 'شيخ الفحم صغير', wholesale: 0, usd: 11.53 },
        { cat: 'فحم', name: 'شيخ الفحم شوال (كبير)', wholesale: 0, usd: 18.80 },
        { cat: 'فحم', name: 'مرجانا فحم', wholesale: 10.00, usd: 9.74 },
        { cat: 'فحم', name: 'فحم الفرفور نوع اول', wholesale: 29.00, usd: 2.94 },
        { cat: 'فحم', name: 'فحم كوكو الزعيم الأصلي', wholesale: 29.00, usd: 2.94 },
        { cat: 'فحم', name: 'فحم الزعيم نص كيلو', wholesale: 30.00, usd: 1.49 },
        { cat: 'فحم', name: 'فحم الزعيم 4 كيلو شوي', wholesale: 7.50, usd: 0 },
        { cat: 'فحم', name: 'فحم ايكو نارة', wholesale: 29.00, usd: 1.83 },
        { cat: 'فحم', name: 'فحم الحريك', wholesale: 29.50, usd: 2.99 },
        { cat: 'فحم', name: 'سلفان الاصيل', wholesale: 8.00, usd: 8.20 },
        { cat: 'فحم', name: 'فحم برو ربع', wholesale: 30.00, usd: 0.76 },
        { cat: 'فحم', name: 'فحم برو نص كيلة', wholesale: 30.00, usd: 1.49 },

        // فيب
        { cat: 'فيب', name: 'فيب الفاخر 40000', wholesale: 10.00, usd: 11.53 },
        { cat: 'فيب', name: 'فيب الفاخر 12000', wholesale: 9.50, usd: 9.82 },
        { cat: 'فيب', name: 'فيب الفاخر 8000', wholesale: 8.50, usd: 8.97 },
        { cat: 'فيب', name: 'فيب ملكي 1500', wholesale: 0, usd: 0 },
        { cat: 'فيب', name: 'فيب ملكي 10000', wholesale: 7.00, usd: 7.26 },
        { cat: 'فيب', name: 'فيب ملكي 18000', wholesale: 8.00, usd: 8.54 },
        { cat: 'فيب', name: 'فيب ملكي 20000', wholesale: 9.00, usd: 9.40 },
        { cat: 'فيب', name: 'فيب فوزول 20000', wholesale: 7.50, usd: 0 },

        // قداحات
        { cat: 'قداحات', name: 'قداحات فينكس ضو الاصلية', wholesale: 80.00, usd: 4.27 },
        { cat: 'قداحات', name: 'قداحات بايدا ضو الاصلية', wholesale: 69.00, usd: 3.84 },

        // اركيلة
        { cat: 'اركيلة', name: 'اركيلة الزعيم واجهة', wholesale: 0, usd: 25.64 }
      ];

      productsToSeed.forEach(p => {
        insertProduct.run(getCatId(p.cat), p.name, p.usd || 0, p.wholesale || 0);
      });
    });
    
    seedTransaction();
  }
}

async function startServer() {
  initDb();
  const app = express();
  app.use(express.json());

  // API Routes
  app.get('/api/categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
    res.json(categories);
  });

  app.post('/api/categories/reorder', (req, res) => {
    const { orders } = req.body; // Array of { id: number, sort_order: number }
    const update = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
    const transaction = db.transaction((items) => {
      for (const item of items) update.run(item.sort_order, item.id);
    });
    transaction(orders);
    res.json({ success: true });
  });

  app.get('/api/products', (req, res) => {
    const products = db.prepare(`
      SELECT p.*, c.name as category_name, c.sort_order as category_sort_order
      FROM products p 
      JOIN categories c ON p.category_id = c.id
      ORDER BY c.sort_order ASC, p.name ASC
    `).all();
    res.json(products);
  });

  app.post('/api/products', (req, res) => {
    const { category_id, name, cost_usd, profit_syp, wholesale_profit_syp, carton_usd, wholesale_carton_usd } = req.body;
    const effectiveCost = cost_usd || 0;
    const effectiveCarton = carton_usd || effectiveCost || 0;
    
    const info = db.prepare(`
      INSERT INTO products (category_id, name, cost_usd, profit_syp, wholesale_profit_syp, carton_usd, wholesale_carton_usd, is_hidden) 
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(category_id, name, effectiveCost, profit_syp || 500, wholesale_profit_syp || 250, effectiveCarton, wholesale_carton_usd || 0);
    res.json({ id: info.lastInsertRowid });
  });

  app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { name, cost_usd, profit_syp, wholesale_profit_syp, carton_usd, wholesale_carton_usd, category_id, is_hidden } = req.body;
    
    // If cost_usd is provided, also update carton_usd for backward compatibility and fallback
    const effectiveCartonUsd = cost_usd !== undefined ? cost_usd : carton_usd;

    db.prepare(`
      UPDATE products 
      SET name = COALESCE(?, name), 
          cost_usd = COALESCE(?, cost_usd),
          profit_syp = COALESCE(?, profit_syp),
          wholesale_profit_syp = COALESCE(?, wholesale_profit_syp),
          carton_usd = COALESCE(?, ?), 
          wholesale_carton_usd = COALESCE(?, wholesale_carton_usd),
          category_id = COALESCE(?, category_id),
          is_hidden = COALESCE(?, is_hidden)
      WHERE id = ?
    `).run(
      name, 
      cost_usd, 
      profit_syp, 
      wholesale_profit_syp, 
      effectiveCartonUsd, carton_usd,
      wholesale_carton_usd, 
      category_id, 
      is_hidden, 
      id
    );
    res.json({ success: true });
  });

  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ success: true });
  });

  app.get('/api/settings/global-rate', (req, res) => {
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('global_rate') as any;
    res.json({ rate: Number(setting?.value || 11700) });
  });

  app.post('/api/settings/global-rate', (req, res) => {
    const { rate } = req.body;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('global_rate', String(rate));
    res.json({ success: true });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false 
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
