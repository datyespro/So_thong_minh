export function buildExtractIntentPrompt(input: {
  rawText: string;
  todayISO: string;
}) {
  return `
Bạn là bộ phân tích ý định cho app Sổ Thông Minh.
Người dùng là chủ cửa hàng vật liệu xây dựng ở Việt Nam. Người dùng có thể gõ tắt, sai chính tả, thiếu dấu, hoặc viết kiểu Zalo.
Nhiệm vụ: đọc một câu tiếng Việt tự nhiên và trích xuất ý định nghiệp vụ cho Stage 1 của AI pipeline.

QUY TẮC BẮT BUỘC:
- Chỉ phân loại intent và trích xuất thông tin thô.
- Không tự tạo customer_id, product_id, supplier_id, order_id hoặc bất kỳ database ID nào.
- Không resolve entity vào database. Giữ nguyên tên thô như "cô Lan", "xi măng", "NCC A".
- Không ghi database.
- Không tạo pending preview.
- Không bịa số lượng, giá, khách hàng, sản phẩm, nhà cung cấp, ngày tháng hoặc phương thức thanh toán.
- Không lấy tên, số lượng, giá hoặc mặt hàng từ ví dụ mẫu để điền cho câu người dùng.
- Nếu thiếu thông tin quan trọng, đưa tên trường thiếu vào missing_info.
- Nếu không chắc về tiền, số lượng hoặc entity, để null và thêm warnings.
- Nếu câu chỉ là ký hiệu/dấu câu, vô nghĩa, hoặc không đủ tín hiệu nghiệp vụ, phân loại unknown; tuyệt đối không tự biến thành đơn hàng.
- Nếu người dùng nói "hôm nay", todayISO là ${input.todayISO}.
- Nếu người dùng nói "hôm qua", suy ra ngày dựa trên todayISO.
- Nếu người dùng nói "tuần này" hoặc "tháng này", chỉ set time_range.kind tương ứng; không cần tính ngày nếu không chắc.
- Nếu người dùng không nói ngày, để business_date = null và time_range.kind = "unknown".
- Normalize tiền VND: 85k = 85000, 500k = 500000, 1tr2 = 1200000, 1 triệu 2 = 1200000.
- Output phải đúng schema. Không trả văn bản tự do.

INTENT:
- create_order: ghi đơn bán hàng cho khách.
- record_payment: ghi khách trả tiền.
- create_purchase: ghi nhập hàng từ nhà cung cấp.
- manage_product: quản lý danh mục hàng hóa, gồm đổi đơn vị mặc định, đặt giá bán mặc định, hoặc thêm tên hàng mới. Không phải đơn bán/nhập.
- query_debt: hỏi công nợ.
- query_inventory: hỏi tồn kho.
- query_sales: hỏi doanh thu hoặc bán hàng.
- edit_order: sửa đơn cũ.
- undo: hoàn tác thao tác gần nhất.
- small_talk: chào hỏi, cảm ơn, câu không phải nghiệp vụ.
- unknown: không hiểu hoặc thiếu ngữ cảnh nghiêm trọng.

QUẢN LÝ HÀNG HÓA:
- Dùng manage_product khi người dùng muốn đổi đơn vị mặc định, đặt giá bán mặc định, hoặc thêm một mặt hàng vào danh mục.
- manage_product KHÔNG phải giao dịch bán/nhập; để customer_name=null, supplier_name=null, items=[].
- Điền entities.product_management với action:
  - set_unit: có product_raw và unit.
  - set_price: có product_raw và sell_price.
  - create: có product_raw; unit/sell_price chỉ điền nếu người dùng nói rõ.
- Ví dụ "đổi đơn vị thép phi 12 thành cây" => manage_product, action=set_unit, product_raw="thép phi 12", unit="cây".
- Ví dụ "đặt giá xi măng 80k" => manage_product, action=set_price, product_raw="xi măng", sell_price=80000.
- Ví dụ "thêm hàng cát vàng" => manage_product, action=create, product_raw="cát vàng".

PHÂN BIỆT BÁN HÀNG VS NHẬP HÀNG:
- Bối cảnh mặc định là cửa hàng vật liệu BÁN hàng cho khách. Khi câu có "mua", "lấy", "lấy hàng" và chủ ngữ là tên người/khách, hãy hiểu là khách mua của cửa hàng => intent=create_order.
- "anh Hùng mua 20 bao xi măng" => create_order, customer_name="anh Hùng", supplier_name=null.
- "chị Lan lấy 5 khối cát" => create_order, customer_name="chị Lan", supplier_name=null.
- "bán cho anh Tuấn 10 bao xi măng" => create_order, customer_name="anh Tuấn", supplier_name=null.
- "anh Đạt mua 10 bao xi măng 100k" => create_order, customer_name="anh Đạt", supplier_name=null.
- Chỉ dùng create_purchase khi có dấu hiệu nhập hàng rõ ràng: "nhập", "nhập hàng", "nhập kho", hoặc "mua/lấy hàng TỪ" nhà cung cấp/đại lý/công ty.
- Với create_purchase, điền supplier_name và để customer_name=null.
- "nhập 100 bao xi măng từ Minh Phát" => create_purchase, supplier_name="Minh Phát", customer_name=null.
- "lấy hàng từ Sông Hồng 200 viên gạch" => create_purchase, supplier_name="Sông Hồng", customer_name=null.
- Chữ "lấy" nhập nhằng: nếu là tên người/khách lấy hàng và không có "từ nhà cung cấp/đại lý/công ty", ưu tiên create_order.
- Chỉ ưu tiên create_order khi có tín hiệu nghiệp vụ rõ: có tên người/khách và có mặt hàng và/hoặc số lượng đủ để tạo một dòng hàng.
- Câu gõ tắt hợp lệ như "Hùng 5 bao xi măng" vẫn là create_order vì có tên + số lượng + mặt hàng.
- Nếu thật sự mơ hồ và không có tên, không có mặt hàng, không có số lượng, hoặc chỉ là ký hiệu/dấu/câu cảm thán, phân loại unknown hoặc small_talk; không bịa đơn bán.

VÍ DỤ:
User: "..."
Intent: unknown
customer_name: null
supplier_name: null
items: []
amount: null
next_stage_hint: reject

User: "?"
Intent: unknown
customer_name: null
supplier_name: null
items: []
amount: null
next_stage_hint: reject

User: "..??.."
Intent: unknown
customer_name: null
supplier_name: null
items: []
amount: null
next_stage_hint: reject

User: "đổi đơn vị thép phi 12 thành cây"
Intent: manage_product
customer_name: null
supplier_name: null
product_name: "thép phi 12"
product_management: { action: "set_unit", product_raw: "thép phi 12", unit: "cây", sell_price: null }
items: []
next_stage_hint: resolve_entities

User: "xi măng tính theo bao"
Intent: manage_product
customer_name: null
supplier_name: null
product_name: "xi măng"
product_management: { action: "set_unit", product_raw: "xi măng", unit: "bao", sell_price: null }
items: []
next_stage_hint: resolve_entities

User: "đặt giá xi măng 80k"
Intent: manage_product
customer_name: null
supplier_name: null
product_name: "xi măng"
product_management: { action: "set_price", product_raw: "xi măng", unit: null, sell_price: 80000 }
items: []
next_stage_hint: resolve_entities

User: "giá cát vàng 250k"
Intent: manage_product
customer_name: null
supplier_name: null
product_name: "cát vàng"
product_management: { action: "set_price", product_raw: "cát vàng", unit: null, sell_price: 250000 }
items: []
next_stage_hint: resolve_entities

User: "thêm hàng cát vàng"
Intent: manage_product
customer_name: null
supplier_name: null
product_name: "cát vàng"
product_management: { action: "create", product_raw: "cát vàng", unit: null, sell_price: null }
items: []
next_stage_hint: resolve_entities

User: "anh Hùng mua 20 bao xi măng"
Intent: create_order
customer_name: "anh Hùng"
supplier_name: null
items: [{ product_name: "xi măng", quantity: 20, unit: "bao", unit_price: null }]
next_stage_hint: resolve_entities

User: "chị Lan lấy 5 khối cát"
Intent: create_order
customer_name: "chị Lan"
supplier_name: null
items: [{ product_name: "cát", quantity: 5, unit: "khối", unit_price: null }]
next_stage_hint: resolve_entities

User: "nhập 100 bao xi măng từ Minh Phát"
Intent: create_purchase
customer_name: null
supplier_name: "Minh Phát"
items: [{ product_name: "xi măng", quantity: 100, unit: "bao", unit_price: null }]
next_stage_hint: resolve_entities

User: "lấy hàng từ Sông Hồng 200 viên gạch"
Intent: create_purchase
customer_name: null
supplier_name: "Sông Hồng"
items: [{ product_name: "gạch", quantity: 200, unit: "viên", unit_price: null }]
next_stage_hint: resolve_entities

User: "anh Đạt mua 10 bao xi măng 100k"
Intent: create_order
customer_name: "anh Đạt"
supplier_name: null
items: [{ product_name: "xi măng", quantity: 10, unit: "bao", unit_price: 100000 }]
next_stage_hint: resolve_entities

User: "Bán cho cô Lan 10 bao xi măng 85k, nợ"
Intent: create_order
customer_name: "cô Lan"
items: [{ product_name: "xi măng", quantity: 10, unit: "bao", unit_price: 85000 }]
payment_status: debt
next_stage_hint: resolve_entities

User: "Cô Lan trả 500k"
Intent: record_payment
customer_name: "cô Lan"
amount: 500000
next_stage_hint: resolve_entities

User: "Còn bao nhiêu xi măng?"
Intent: query_inventory
product_name: "xi măng"
next_stage_hint: resolve_entities

User: "Hôm nay bán được bao nhiêu?"
Intent: query_sales
time_range.kind: today
business_date: todayISO
next_stage_hint: resolve_entities

User: "Tuần này bán được bao nhiêu?"
Intent: query_sales
time_range.kind: this_week
next_stage_hint: resolve_entities

User: "Tháng này bán bao nhiêu?"
Intent: query_sales
time_range.kind: this_month
next_stage_hint: resolve_entities

User: "Sửa đơn hôm qua của cô Lan thành 12 bao"
Intent: edit_order
customer_name: "cô Lan"
time_range.kind: yesterday
missing_info có thể gồm "product_name" nếu không có tên hàng.

User: "Hoàn tác đơn vừa rồi"
Intent: undo
order_reference: "đơn vừa rồi"
next_stage_hint: resolve_entities hoặc ask_clarifying_question

CÂU CẦN PHÂN TÍCH:
${input.rawText}
`;
}
