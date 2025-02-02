const medicineGroupingHandler = {
    // 檢查是否應該顯示分類按鈕
    async shouldShowGroupingButton() {
        const { enableMedicineGrouping } = await new Promise(resolve => {
            chrome.storage.sync.get({ enableMedicineGrouping: false }, resolve);
        });

        if (!enableMedicineGrouping) {
            console.log('藥物分類顯示功能未啟用');
            return false;
        }

        const table = document.querySelector('table');
        if (!table) return false;

        // 檢查頁數條件
        const maxPage = window.nextPagingHandler.state.maxPage;
        // 只有在自動翻頁完成時才顯示按鈕
        const isAutoPageCompleted = window.autoPagingHandler && 
                                  window.autoPagingHandler.accumulatedData &&
                                  Object.keys(window.autoPagingHandler.accumulatedData).length > 0 &&
                                  !window.autoPagingHandler.state.isProcessing;

        // 如果只有一頁，直接顯示按鈕
        if (maxPage === 1) {
            return true;
        }
        
        // 如果有多頁，只在自動翻頁完成後顯示
        if (maxPage > 1) {
            return isAutoPageCompleted;
        }

        return false;
    },

    // 對藥品進行整理
    categorizeMedicines(medicines) {
        console.log('開始分類藥物，接收資料:', medicines);
        const medicineMap = new Map();
    
        medicines.forEach(medicine => {
            // 確保藥品資料完整
            if (!medicine || !medicine.name) {
                console.log('跳過無效藥物資料:', medicine);
                return;
            }
    
            if (!medicineMap.has(medicine.name)) {
                medicineMap.set(medicine.name, []);
            }
            
            // 整理記錄資料
            const record = {
                date: medicine.date || '',
                days: medicine.days || '0',
                dosage: medicine.dosage || '',
                usage: medicine.usage || ''
            };
    
            // 只添加有用藥天數的記錄
            if (record.days && record.dosage) {
                medicineMap.get(medicine.name).push(record);
            }
        });
    
        console.log('分類後的藥物資料:', medicineMap);
        return medicineMap;
    },

    createGroupingWindow(medicineMap) {
        const container = document.createElement('div');
        container.id = 'medicine-grouping-window';
        container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 15px rgba(0,0,0,0.2);
            width: 1000px;
            height: 80vh;
            z-index: 10002;
            display: flex;
            flex-direction: column;
        `;
    
        // 標題和關閉按鈕
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #d3efff;
            flex-shrink: 0;
        `;
        
        const title = document.createElement('h2');
        title.textContent = '長期處方藥物 (≧7天)表格整理';
        title.style.cssText = `
            margin: 0;
            color: #2196F3;
            font-size: 20px;
        `;
    
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            padding: 0;
        `;
        closeButton.onclick = () => container.remove();
    
        header.appendChild(title);
        header.appendChild(closeButton);
        container.appendChild(header);
    
        // 內容區域容器
        const contentContainer = document.createElement('div');
        contentContainer.style.cssText = `
            flex-grow: 1;
            overflow: auto;
        `;
    
        // 收集有效的藥物（有長期處方的藥物）
        const validMedicines = new Map();
        const allDates = new Set();
    
        medicineMap.forEach((records, medicineName) => {
            // 檢查是否有任何長期處方記錄
            const hasLongTermPrescription = records.some(record => parseInt(record.days) >= 7);
            if (hasLongTermPrescription) {
                validMedicines.set(medicineName, records);
                records.forEach(record => {
                    if (parseInt(record.days) >= 7) {
                        allDates.add(record.date);
                    }
                });
            }
        });
    
        // 如果沒有符合條件的藥物，顯示提示訊息
        if (validMedicines.size === 0) {
            const noDataMsg = document.createElement('div');
            noDataMsg.textContent = '沒有發現處方天數≧7天的藥物';
            noDataMsg.style.textAlign = 'center';
            noDataMsg.style.color = '#666';
            noDataMsg.style.marginTop = '20px';
            contentContainer.appendChild(noDataMsg);
            container.appendChild(contentContainer);
            return container;
        }
    
        // 建立表格包裝器，用於處理水平滾動
        // const tableWrapper = document.createElement('div');
        // tableWrapper.style.cssText = `
        //     overflow: auto;
        //     width: 100%;
        // `;

        // 在建立表格內容之前，先準備簡化的藥品名稱
        const simplifiedMedicineMap = new Map();
        medicineMap.forEach((records, medicineName) => {
            const hasLongTermPrescription = records.some(record => parseInt(record.days) >= 7);
            if (hasLongTermPrescription) {
                // 使用 medicineProcessor 的 simplifyMedicineName
                const simplifiedName = window.medicineProcessor.simplifyMedicineName(medicineName);
                simplifiedMedicineMap.set(simplifiedName, records);
            }
        });

        // 建立表格
        const table = document.createElement('table');
        table.style.cssText = `
            border-collapse: collapse;
            width: max-content;
            min-width: 100%;
            background-color: white;
            table-layout: fixed;
        `;
    
        // 建立表頭
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        // 藥品名稱列標題 - 調整寬度
        const nameHeader = document.createElement('th');
        nameHeader.textContent = '藥品名稱';
        nameHeader.style.cssText = `
            position: sticky;
            left: 0;
            z-index: 2;
            background-color: #f5f5f5;
            padding: 12px;
            text-align: left;
            border: 1px solid #e0e0e0;
            width: 300px;
            top: 0;
        `;
        headerRow.appendChild(nameHeader);
    
        // 日期列標題
        const sortedDates = Array.from(allDates).sort((a, b) => new Date(b) - new Date(a));
        sortedDates.forEach(date => {
            const dateHeader = document.createElement('th');
            dateHeader.textContent = date;
            dateHeader.style.cssText = `
                padding: 12px;
                text-align: center;
                border: 1px solid #e0e0e0;
                min-width: 150px;
                background-color: #f5f5f5;
                position: sticky;
                top: 0;
            `;
            headerRow.appendChild(dateHeader);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 建立表格內容
        const tbody = document.createElement('tbody');
        simplifiedMedicineMap.forEach((records, simplifiedName) => {
            const row = document.createElement('tr');
            
            // 藥品名稱欄 - 允許斷行
            const nameCell = document.createElement('td');
            // 每20個字元添加一個斷行機會
            const formattedName = simplifiedName.replace(/(.{20})/g, '$1\u200B');
            nameCell.textContent = formattedName;
            nameCell.style.cssText = `
                position: sticky;
                left: 0;
                background-color: white;
                padding: 12px;
                border: 1px solid #e0e0e0;
                width: 300px;
                word-wrap: break-word;
                word-break: break-all;
                white-space: pre-wrap;
                line-height: 1.3;
                z-index: 1;
            `;
            row.appendChild(nameCell);

            // 各日期的用藥資訊
            sortedDates.forEach(date => {
                const cell = document.createElement('td');
                const record = records.find(r => r.date === date);
                if (record && parseInt(record.days) >= 7) {
                    const perDosage = window.medicineProcessor.calculatePerDosage(
                        record.dosage,
                        record.usage,
                        record.days
                    );
                    const dosageText = perDosage === 'SPECIAL' ? 
                        `總量${record.dosage}` : 
                        `${perDosage}#`;
                    cell.textContent = `${dosageText} ${record.usage} ${record.days}d`;
                }
                cell.style.cssText = `
                    padding: 12px;
                    border: 1px solid #e0e0e0;
                    text-align: center;
                    background-color: white;
                    min-width: 150px;
                `;
                row.appendChild(cell);
            });

            // 交替行背景色
            if (tbody.childNodes.length % 2 === 1) {
                nameCell.style.backgroundColor = '#f8f9fa';
                Array.from(row.children).slice(1).forEach(cell => {
                    cell.style.backgroundColor = '#f8f9fa';
                });
            }

            tbody.appendChild(row);
        });

        table.appendChild(tbody);

        // 表格容器
        const tableWrapper = document.createElement('div');
        tableWrapper.style.cssText = `
            overflow: auto;
            width: 100%;
            height: 100%;
        `;
        
        tableWrapper.appendChild(table);
        contentContainer.appendChild(tableWrapper);
        container.appendChild(contentContainer);

        return container;
    },

    async handleGroupingDisplay(medicineData) {
        const flattenedMedicines = [];
        
        // 檢查是否有自動翻頁的累積資料
        const isAutoPageCompleted = window.autoPagingHandler && 
                                   !window.autoPagingHandler.state.isProcessing;
        const hasAccumulatedData = window.autoPagingHandler?.accumulatedData && 
                                  Object.keys(window.autoPagingHandler.accumulatedData).length > 0;
        
        // 統一資料處理邏輯
        const processData = (data) => {
            Object.entries(data).forEach(([date, group]) => {
                if (typeof group === 'object' && group !== null) {
                    const medicines = group.medicines || [];
                    medicines.forEach(medicine => {
                        if (medicine) {
                            flattenedMedicines.push({
                                ...medicine,
                                date: group.date || date
                            });
                        }
                    });
                }
            });
        };
        
        // 根據不同來源處理資料
        if (isAutoPageCompleted && hasAccumulatedData) {
            console.log('處理累積資料');
            processData(window.autoPagingHandler.accumulatedData);
        } else {
            console.log('處理當前頁面資料');
            processData(medicineData);
        }
    
        // 對藥品進行整理
        const categorizedMedicines = this.categorizeMedicines(flattenedMedicines);
        
        // 創建並顯示視窗
        const groupingWindow = this.createGroupingWindow(categorizedMedicines);
        document.body.appendChild(groupingWindow);
    }
};

// 將處理器掛載到 window 上
window.medicineGroupingHandler = medicineGroupingHandler;