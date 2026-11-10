-- ============================================================================
-- seed.sql
-- ============================================================================

INSERT INTO public.categories (
  id, owner_user_id, kind, name, slug, icon, color, phase2_group_hint, default_keywords, is_system_special, sort_order
)
VALUES
  ('00000000-0000-4000-8000-000000000101', NULL, 'expense', 'Ăn uống (bữa chính)', 'food_main', 'circle', '#FF6B00', 'Thiết yếu', ARRAY['ăn sáng', 'ăn trưa', 'ăn tối', 'cơm', 'phở', 'bún', 'mì', 'bánh mì', 'xôi'], FALSE, 1),
  ('00000000-0000-4000-8000-000000000102', NULL, 'expense', 'Đi chợ/siêu thị', 'groceries', 'arch', '#00B853', 'Thiết yếu', ARRAY['đi chợ', 'siêu thị', 'bachhoaxanh', 'winmart', 'coopmart', 'rau', 'thịt', 'trái cây'], FALSE, 2),
  ('00000000-0000-4000-8000-000000000103', NULL, 'expense', 'Đi lại', 'transport', 'hexagon', '#0057FF', 'Thiết yếu', ARRAY['xăng', 'grab', 'be', 'xanh sm', 'gửi xe', 'vé xe', 'taxi', 'bus'], FALSE, 3),
  ('00000000-0000-4000-8000-000000000104', NULL, 'expense', 'Đồ dùng cá nhân', 'personal_care', 'triangle', '#FF7CE5', 'Thiết yếu', ARRAY['dầu gội', 'sữa tắm', 'kem đánh răng', 'cắt tóc', 'giặt ủi', 'mỹ phẩm'], FALSE, 4),
  ('00000000-0000-4000-8000-000000000201', NULL, 'expense', 'Tiền nhà', 'rent', 'square', '#0057FF', 'Hóa đơn cố định', ARRAY['tiền nhà', 'tiền phòng', 'tiền trọ'], FALSE, 5),
  ('00000000-0000-4000-8000-000000000202', NULL, 'expense', 'Điện nước', 'utilities', 'triangle', '#FFC700', 'Hóa đơn cố định', ARRAY['tiền điện', 'tiền nước', 'điện nước', 'phí quản lý'], FALSE, 6),
  ('00000000-0000-4000-8000-000000000203', NULL, 'expense', 'Internet/điện thoại', 'telecom', 'hexagon', '#0057FF', 'Hóa đơn cố định', ARRAY['wifi', 'internet', 'cước điện thoại', 'nạp đt', 'nạp điện thoại', '4g', '5g', 'viettel', 'mobifone', 'vinaphone'], FALSE, 7),
  ('00000000-0000-4000-8000-000000000204', NULL, 'expense', 'Subscription', 'subscription', 'square', '#FF7CE5', 'Hóa đơn cố định', ARRAY['netflix', 'spotify', 'youtube', 'icloud', 'chatgpt', 'claude', 'canva'], FALSE, 8),
  ('00000000-0000-4000-8000-000000000301', NULL, 'expense', 'Gửi bố mẹ', 'family_support', 'arch', '#FF7CE5', 'Gửi về nhà', ARRAY['gửi bố mẹ', 'gửi mẹ', 'gửi ba', 'biếu bố mẹ', 'gửi về nhà'], FALSE, 9),
  ('00000000-0000-4000-8000-000000000401', NULL, 'expense', 'Đám cưới', 'wedding', 'triangle', '#FF6B00', 'Hiếu hỉ', ARRAY['đám cưới', 'mừng cưới', 'phong bì cưới', 'tiền cưới'], FALSE, 10),
  ('00000000-0000-4000-8000-000000000402', NULL, 'expense', 'Sinh nhật', 'birthday', 'circle', '#FF7CE5', 'Hiếu hỉ', ARRAY['sinh nhật', 'quà sinh nhật'], FALSE, 11),
  ('00000000-0000-4000-8000-000000000403', NULL, 'expense', 'Thăm hỏi', 'visiting', 'arch', '#FFC700', 'Hiếu hỉ', ARRAY['thăm bệnh', 'thăm hỏi', 'đám giỗ', 'phúng điếu'], FALSE, 12),
  ('00000000-0000-4000-8000-000000000404', NULL, 'expense', 'Quà tặng', 'gifts', 'square', '#FF6B00', 'Hiếu hỉ', ARRAY['quà', 'tặng quà', 'lì xì'], FALSE, 13),
  ('00000000-0000-4000-8000-000000000501', NULL, 'expense', 'Cafe/trà sữa', 'coffee_tea', 'circle', '#FF6B00', 'Vui chơi', ARRAY['cafe', 'cà phê', 'cf', 'trà sữa', 'highlands', 'phúc long', 'starbucks', 'katinat', 'phela'], FALSE, 14),
  ('00000000-0000-4000-8000-000000000502', NULL, 'expense', 'Ăn ngoài/nhậu', 'dining_out', 'square', '#FFC700', 'Vui chơi', ARRAY['ăn ngoài', 'nhậu', 'bia', 'lẩu', 'nướng', 'bbq', 'buffet', 'ốc'], FALSE, 15),
  ('00000000-0000-4000-8000-000000000503', NULL, 'expense', 'Đặt đồ ăn', 'food_delivery', 'triangle', '#FF6B00', 'Vui chơi', ARRAY['grabfood', 'shopeefood', 'befood', 'đặt đồ ăn', 'ăn vặt'], FALSE, 16),
  ('00000000-0000-4000-8000-000000000504', NULL, 'expense', 'Giải trí', 'entertainment', 'hexagon', '#FF7CE5', 'Vui chơi', ARRAY['xem phim', 'cgv', 'lotte cinema', 'game', 'karaoke', 'concert', 'bida'], FALSE, 17),
  ('00000000-0000-4000-8000-000000000505', NULL, 'expense', 'Mua sắm', 'shopping', 'triangle', '#FF7CE5', 'Vui chơi', ARRAY['shopee', 'lazada', 'tiktok shop', 'quần áo', 'giày', 'áo', 'quần', 'mua sắm'], FALSE, 18),
  ('00000000-0000-4000-8000-000000000506', NULL, 'expense', 'Du lịch', 'travel', 'circle', '#0057FF', 'Vui chơi', ARRAY['du lịch', 'vé máy bay', 'khách sạn', 'homestay', 'resort'], FALSE, 19),
  ('00000000-0000-4000-8000-000000000601', NULL, 'expense', 'Khám bệnh/thuốc', 'healthcare', 'arch', '#00B853', 'Sức khỏe & phát triển', ARRAY['thuốc', 'khám bệnh', 'nha khoa', 'bệnh viện', 'pharmacity', 'long châu'], FALSE, 20),
  ('00000000-0000-4000-8000-000000000602', NULL, 'expense', 'Gym/thể thao', 'fitness', 'hexagon', '#00B853', 'Sức khỏe & phát triển', ARRAY['gym', 'cầu lông', 'bơi', 'chạy bộ', 'yoga', 'pickleball', 'đá bóng'], FALSE, 21),
  ('00000000-0000-4000-8000-000000000603', NULL, 'expense', 'Học tập', 'education', 'square', '#0057FF', 'Sức khỏe & phát triển', ARRAY['sách', 'khóa học', 'học tiếng anh', 'ielts', 'coursera', 'udemy'], FALSE, 22),
  ('00000000-0000-4000-8000-000000000701', NULL, 'expense', 'Phí', 'fee', 'square', '#141413', 'Đặc biệt', ARRAY['phí chuyển khoản', 'phí thường niên', 'phí rút tiền', 'phí'], TRUE, 23),
  ('00000000-0000-4000-8000-000000000702', NULL, 'expense', 'Không nhớ rõ', 'unknown_expense', 'circle', '#141413', 'Đặc biệt', ARRAY['không nhớ', 'quên', 'không rõ'], TRUE, 24),
  ('00000000-0000-4000-8000-000000000801', NULL, 'income', 'Lương', 'salary', 'arch', '#00B853', 'Thu nhập', ARRAY['lương', 'nhận lương'], FALSE, 1),
  ('00000000-0000-4000-8000-000000000802', NULL, 'income', 'Thưởng', 'bonus', 'circle', '#FFC700', 'Thu nhập', ARRAY['thưởng', 'nhận thưởng', 'kpi', 'thưởng tết'], FALSE, 2),
  ('00000000-0000-4000-8000-000000000803', NULL, 'income', 'Freelance/làm thêm', 'freelance', 'hexagon', '#0057FF', 'Thu nhập', ARRAY['freelance', 'job ngoài', 'làm thêm', 'OT'], FALSE, 3),
  ('00000000-0000-4000-8000-000000000804', NULL, 'income', 'Được cho/tặng', 'gifted_income', 'triangle', '#FF7CE5', 'Thu nhập', ARRAY['được tặng', 'được cho', 'mẹ cho', 'bố cho'], FALSE, 4),
  ('00000000-0000-4000-8000-000000000805', NULL, 'income', 'Hoàn tiền/cashback', 'cashback', 'circle', '#00B853', 'Thu nhập', ARRAY['hoàn tiền', 'cashback'], FALSE, 5),
  ('00000000-0000-4000-8000-000000000806', NULL, 'income', 'Khác', 'other_income', 'square', '#0057FF', 'Thu nhập', ARRAY['thu khác'], FALSE, 6),
  ('00000000-0000-4000-8000-000000000807', NULL, 'income', 'Thu nhập không rõ', 'unknown_income', 'arch', '#141413', 'Đặc biệt', ARRAY[]::TEXT[], TRUE, 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.exchange_rates (rate_date, base_currency, quote_currency, rate, source)
VALUES
  (CURRENT_DATE, 'USD', 'VND', 25400.000000, 'api'),
  (CURRENT_DATE, 'EUR', 'VND', 27500.000000, 'api'),
  (CURRENT_DATE, 'JPY', 'VND', 168.000000, 'api'),
  (CURRENT_DATE, 'KRW', 'VND', 18.500000, 'api'),
  (CURRENT_DATE, 'SGD', 'VND', 19000.000000, 'api'),
  (CURRENT_DATE, 'THB', 'VND', 745.000000, 'api')
ON CONFLICT (rate_date, base_currency, quote_currency) DO NOTHING;

