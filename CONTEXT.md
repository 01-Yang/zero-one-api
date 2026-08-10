# 零一 API 词汇表

**Public Site（官网）**:
访客在使用产品前看到的品牌入口，负责呈现零一 API 并引导注册、登录和查看模型。
_Avoid_: 首页后台、控制台首页

**Console（控制台）**:
用户和管理员登录后管理密钥、用量、兑换及系统资源的产品界面。
_Avoid_: 官网、React 后台

**Primary API Domain（主 API 域名）**:
零一 API 唯一公开推荐的模型调用地址。
_Avoid_: 主线路组、官网域名

**Backup API Domain（备用 API 域名）**:
主 API 域名不可用时由用户手动选择的备用调用地址，不代表自动故障转移或独立服务器。
_Avoid_: 高可用地址、自动容灾地址

**User（用户）**:
注册零一 API、创建 API Key 并消费模型服务的个人或团队成员。
_Avoid_: 上游账号、号池账号

**Administrator（管理员）**:
拥有系统运维权限、可管理用户、Provider Account、渠道、价格、设置和 Redeem Code 的角色。
_Avoid_: 普通用户、站长账号

**Provider Account（上游账号）**:
向零一 API 提供模型调用能力和额度的已授权账号资源。
_Avoid_: User、客户账号

**API Key（密钥）**:
User 创建并用于鉴权模型 API 请求的凭证。
_Avoid_: Provider Account 凭证、管理员密码

**Redeem Code（兑换码）**:
由 Administrator 创建、由 User 核销以获得余额、并发或订阅权益的凭证。
_Avoid_: 在线支付、购买促销码、优惠券

**Promo Code（购买促销码）**:
在线购买流程中调整订单价格的营销凭证。
_Avoid_: Redeem Code
