# Kitchen Counter Chaos — 廚房檯面大亂飛

## 核心概念與遊戲模式

玩家是一隻圓潤、光滑、大紅眼的小蒼蠅，在巨大日常物件之間飛行。以暖木色檯面、奶油色背景、薄荷色路線搭配鮮明食物顏色，形成容易辨識的卡通廚房。

起點與終點共用同一道黑白旗門，沿蜿蜒環形廚房賽道正向完成一圈才過關。可自由選擇內外線及高度，不需穿圈或收集食物；倒退跨線不能增加圈數。撞牆、碰道具或落地不會死亡／重生，撞到障礙物、牆面或被蒼蠅拍／水花擊中會落地暈眩 1.2 秒，隨後恢復控制並提供 2 秒保護，保留時間和行程。

入口提供單人與多人選擇。多人支援創房及八碼房號加入，創房者的瀏覽器就是房主，不需另開遊戲伺服器；公共 PeerJS 訊令服務負責建立 WebRTC 連線，因此仍需網際網路。房主計算所有玩家的神經輸出、飛行、一圈進度和攻擊，最多八人；黑客松建議先用 2–4 台電腦。已有同步倒數、排名、完賽時間與再戰，尚未驗證八人負載；房主離開會結束房間。

F 是每隻蒼蠅固定擁有的前向嗡鳴攻擊，冷卻 1.5 秒，可按住連發，不需拾取道具。射程 8 單位、前方約 ±49°、高度差不超過 3 單位，命中讓對手短暫落地暈眩。金色擴散波顯示出招，恢复保護防止連續暈眩。下方仍保留六鍵飛行操控，另列 F 攻擊；小地圖顯示環線與玩家位置。

## 分區與地標

| 區域              | 主要地標與食物             | 路線用途                                   |
| ----------------- | -------------------------- | ------------------------------------------ |
| 起飛區 → 藍杯彎道 | 巨大藍杯、橘汁攤           | 寬闊起跑空間，果汁表面提供加速             |
| 早餐段            | 果醬吐司、披薩、披薩屑     | 中央快速通路，兩側食物區可繞行             |
| 調味料段          | 高番茄醬瓶、小風扇         | 以瓶身建立垂直尺度，橫風區帶來路線偏移     |
| 水果段            | 果盤、柑橘與水果塊         | 果盤上方高路、兩側低路；中央有定時蒼蠅拍   |
| 洗碗段            | 水槽、彎水龍頭、黃色海綿   | 水花上升干擾，海綿後方有避風空間           |
| 最後衝刺          | 架高砧板、白盤、黑白终點旗 | 從砧板下方穿越或爬升越過，任一路線都能過關 |

## 移動路線

- 主路：沿薄荷色標記向前，保留寬敞中央飛行空間。重複短線、箭頭與碎屑提供近地速度參照。
- 低路：貼著檯面、物件外緣與砧板下方飛行。砧板下方留有可穿越高度。
- 高路：飛越杯子、吐司、果盤與海綿；番茄醬瓶高度更高，需要提前爬升或繞行。
- 側路：兩側檯緣提供分流。大型道具間形成較窄通道，可短暫避開中央干擾。
- 導航：地標使用固定配色與輪廓，终點旗跨越整條通路。玩家不用記憶檢查點順序。

## 危險區與動態元素

| 元素   | 放置與作用                                       | 可讀提示               |
| ------ | ------------------------------------------------ | ---------------------- |
| 橘汁   | 起跑後、靠近主路；貼地接觸增加前進速度           | 橘色區域、JUICE BOOST  |
| 果醬   | 吐司旁低空區，降低橫向與前進速度                 | 粉紅色區域、STICKY JAM |
| 風扇   | 番茄醬瓶對側，產生橫向與上升氣流                 | 青色區域、旋轉扇葉     |
| 蒼蠅拍 | 水果區旁，每 6 秒末段作用 1.5 秒，向下及側向推動 | 橘紅色預告區、可見拍面 |
| 水花   | 水槽附近，每 5 秒末段作用 1.5 秒，向上推動       | 青色預告區、水滴動畫   |

所有效果不觸發死亡。蒼蠅拍和水花使玩家落地暈眩；果醬、果汁和氣流保留速度效果。物品與危險區不顯示名稱牌，只保留終點提示。食物碎屑與水果塊目前是視覺熱點，不是必收集物或計分道具。

## 遊戲流程

準備／房主倒數 → 按住 W/O 起飛 → 自選內外線、貼地或高路 → 吃水果加速、多人 F 攻擊 → 完成一圈回到起終點 → 顯示完成時間與排名 → 再次挑戰。

保留原有神經活動控制和半速訓練功能。掉落後可重新提供翅膀動力繼續前進，不需要等待重生。

## 美術方向

- 明亮暖色，輪廓先於細節；同一地標維持單一主要識別色。
- 蒼蠅採圓頭、圓身、大紅眼與白色高光、透明奶油色翅膀、六隻短腳和兩根短觸角，不做密集毛髮。
- 道具用程序化 3D 幾何建立，不需要下載材質或第三方模型。水槽採淺色框與較深盆底表示凹陷，目前可飛行地板仍使用统一高度。
- 碰撞以寬容的圓柱與盒子近似，主要物件和架高砧板具有碰撞；杯把、水龍頭、碎屑等細部以裝飾為主。

## 可重用模組清單

木色檯面／檯緣、磁磚牆、短線與箭頭、地標名稱牌、藍杯／杯把／杯口、吐司／果醬層、披薩楔形／餅皮／配料、白盤、番茄醬瓶／瓶蓋／標籤、果盤／水果／葉片、盆底／水槽框／排水孔／水龍頭、海綿、砧板與腳架、風扇、蒼蠅拍、危險區圓面、水滴、終點旗、圓潤蒼蠅部件。

場景實作：`lib/kitchen-scene.ts`；共享地圖與危險區資料：`lib/kitchen.ts`；飛行與安全碰撞：`lib/simulation.ts`。

## Current implementation notes

The original 48 floating fruits and kitchen landmarks are placed around a closed, winding centerline. Food grants 2.5 seconds of boost and resets for a new race. CMU stickers remain on selected mugs, bottles and the raised board. The fly stays smooth, round and lightly detailed. The chase camera follows any heading around the full loop.

Single player retains training pace and the interpolated 12-second replay. Multiplayer uses the host clock at full speed, with six flight keys plus the permanently available F attack. See README.md for local two-window and multi-computer demo instructions, signaling dependencies and limitations.

## Social finish

The first one-lap finisher ends the multiplayer race for everyone and opens social cards. Players customize their profile, color, hat and shoes before choosing a mode. Cards show finish/DNF, maximum unstunned flight speed, a gameplay-derived neural style and the final recorded neural activity. PNG and animated GIF exports run locally. Connect uses the supplied social link; View Profile shows the complete bio and optional website.
