let items = [];
let logoBase64 = "";
let currentZoom = 1.0;

// Set default date to today
document.getElementById('invDate').value = new Date().toISOString().split('T')[0];

// Dynamic Currency Formatter with Indian System Support (en-IN)
function formatCurrency(amount, symbol) {
    const locale = (symbol === '₹') ? 'en-IN' : 'en-US';
    return symbol + amount.toLocaleString(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function adjustZoom(delta) {
    currentZoom = Math.min(Math.max(0.8, currentZoom + delta), 1.2);
    document.getElementById('paperCanvas').style.transform = `scale(${currentZoom})`;
    document.getElementById('zoomLevelText').innerText = `${Math.round(currentZoom * 100)}%`;
}

function loadSavedState() {
    const saved = localStorage.getItem('invoicex_draft');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            document.getElementById('custName').value = data.custName || '';
            document.getElementById('invNum').value = data.invNum || 'INV-2026-01';
            document.getElementById('currencySel').value = data.currency || '₹';
            document.getElementById('taxRate').value = data.taxRate || '18';
            document.getElementById('discountVal').value = data.discountVal || '0';
            document.getElementById('discountType').value = data.discountType || 'flat';
            document.getElementById('bankDetails').value = data.bankDetails || '';
            document.getElementById('notes').value = data.notes || '';
            items = data.items || [];
        } catch (e) {
            console.error("Failed to restore state");
        }
    }
}

function saveState() {
    const state = {
        custName: document.getElementById('custName').value,
        invNum: document.getElementById('invNum').value,
        currency: document.getElementById('currencySel').value,
        taxRate: document.getElementById('taxRate').value,
        discountVal: document.getElementById('discountVal').value,
        discountType: document.getElementById('discountType').value,
        bankDetails: document.getElementById('bankDetails').value,
        notes: document.getElementById('notes').value,
        items
    };
    localStorage.setItem('invoicex_draft', JSON.stringify(state));
}

function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            logoBase64 = e.target.result;
            document.getElementById('logoUploadPrompt').classList.add('hidden');
            document.getElementById('logoPreviewContainer').classList.remove('hidden');
            document.getElementById('logoImgPreview').src = logoBase64;
            
            document.getElementById('paperLogoWrapper').classList.remove('hidden');
            document.getElementById('paperLogoImg').src = logoBase64;
            document.getElementById('paperInvoiceHeading').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function removeLogo(event) {
    if (event) event.stopPropagation();
    logoBase64 = "";
    document.getElementById('logoInput').value = "";
    document.getElementById('logoUploadPrompt').classList.remove('hidden');
    document.getElementById('logoPreviewContainer').classList.add('hidden');
    
    document.getElementById('paperLogoWrapper').classList.add('hidden');
    document.getElementById('paperInvoiceHeading').classList.remove('hidden');
}

function addItem() {
    const desc = document.getElementById('itemDesc').value.trim();
    const qty = parseInt(document.getElementById('itemQty').value);
    const price = parseFloat(document.getElementById('itemPrice').value);

    if (!desc || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
        alert("Please enter a valid item description, quantity, and price.");
        return;
    }

    items.push({ desc, qty, price, total: qty * price });

    document.getElementById('itemDesc').value = '';
    document.getElementById('itemQty').value = '';
    document.getElementById('itemPrice').value = '';

    updateUI();
}

function removeItem(index) {
    items.splice(index, 1);
    updateUI();
}

function clearAll() {
    items = [];
    localStorage.removeItem('invoicex_draft');
    document.getElementById('custName').value = '';
    document.getElementById('bankDetails').value = '';
    document.getElementById('notes').value = '';
    removeLogo(null);
    updateUI();
}

function updateUI() {
    const symbol = document.getElementById('currencySel').value;
    
    document.getElementById('prevCustomer').innerText = document.getElementById('custName').value.trim() || 'Client Name';
    document.getElementById('prevInvNum').innerText = document.getElementById('invNum').value.trim() || 'INV-2026-01';
    document.getElementById('prevDate').innerText = `Issued: ${document.getElementById('invDate').value}`;
    
    // Dynamic Due Date Text
    const dueDateInput = document.getElementById('dueDate').value.trim();
    const prevDueDateEl = document.getElementById('prevDueDate');

    if (dueDateInput) {
        if (!isNaN(dueDateInput)) {
            prevDueDateEl.innerText = `Payment Due: In ${dueDateInput} Days`;
        } else {
            prevDueDateEl.innerText = `Due Date: ${dueDateInput}`;
        }
    } else {
        prevDueDateEl.innerText = '';
    }

    document.getElementById('prevBankDetails').innerText = document.getElementById('bankDetails').value.trim();
    document.getElementById('prevNotes').innerText = document.getElementById('notes').value.trim();

    // Render Table
    const tableBody = document.getElementById('itemsTable');
    tableBody.innerHTML = '';
    let subtotal = 0;

    if (items.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="py-8 text-center text-slate-400 italic">
                    No items added yet. Add line items to see live preview.
                </td>
            </tr>
        `;
    } else {
        items.forEach((item, index) => {
            subtotal += item.total;
            const bgClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';
            tableBody.innerHTML += `
                <tr class="${bgClass} hover:bg-slate-100 transition">
                    <td class="py-2.5 px-1 font-semibold text-slate-800">${item.desc}</td>
                    <td class="py-2.5 text-center font-mono">${item.qty}</td>
                    <td class="py-2.5 text-right font-mono">${formatCurrency(item.price, symbol)}</td>
                    <td class="py-2.5 text-right font-mono font-bold text-slate-900">${formatCurrency(item.total, symbol)}</td>
                    <td class="py-2.5 text-right">
                        <button onclick="removeItem(${index})" class="text-slate-400 hover:text-red-500 transition px-1">✕</button>
                    </td>
                </tr>
            `;
        });
    }

    // Calculations
    const discountVal = parseFloat(document.getElementById('discountVal').value) || 0;
    const discountType = document.getElementById('discountType').value;
    
    let discountAmount = (discountType === 'percent') ? (subtotal * (discountVal / 100)) : discountVal;
    discountAmount = Math.min(discountAmount, subtotal);
    
    const discountedSubtotal = subtotal - discountAmount;
    const taxRate = parseFloat(document.getElementById('taxRate').value) || 0;
    const taxAmount = discountedSubtotal * (taxRate / 100);
    const grandTotal = discountedSubtotal + taxAmount;

    const rowDisc = document.getElementById('rowDiscount');
    if (discountAmount > 0) {
        rowDisc.classList.remove('hidden');
        document.getElementById('lblDiscount').innerText = `-${formatCurrency(discountAmount, symbol)}`;
    } else {
        rowDisc.classList.add('hidden');
    }

    document.getElementById('itemCountBadge').innerText = `${items.length} Item${items.length === 1 ? '' : 's'}`;
    document.getElementById('lblSubtotal').innerText = formatCurrency(subtotal, symbol);
    document.getElementById('lblTax').innerText = formatCurrency(taxAmount, symbol);
    document.getElementById('lblGrandTotal').innerText = formatCurrency(grandTotal, symbol);

    saveState();
}

['custName', 'invNum', 'invDate', 'dueDate', 'taxRate', 'discountVal', 'discountType', 'currencySel', 'bankDetails', 'notes'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateUI);
});

function setTheme(color) {
    const root = document.documentElement;
    if (color === 'emerald') root.style.setProperty('--accent-border', '#10b981');
    if (color === 'cyan') root.style.setProperty('--accent-border', '#06b6d4');
    if (color === 'indigo') root.style.setProperty('--accent-border', '#6366f1');
}

async function generatePDF() {
    const customer = document.getElementById('custName').value.trim();
    if (!customer) {
        alert("Please enter a customer/company name.");
        return;
    }
    if (items.length === 0) {
        alert("Please add at least one line item to the invoice.");
        return;
    }

    const payload = {
        customer,
        email: "",
        invoice_no: document.getElementById('invNum').value.trim(),
        inv_date: document.getElementById('invDate').value,
        due_date: document.getElementById('dueDate').value.trim(),
        currency: document.getElementById('currencySel').value,
        tax_rate: document.getElementById('taxRate').value,
        discount_val: document.getElementById('discountVal').value,
        discount_type: document.getElementById('discountType').value,
        items,
        bank_details: document.getElementById('bankDetails').value,
        notes: document.getElementById('notes').value,
        logo_b64: logoBase64
    };

    try {
        const response = await fetch('/generate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const blob = await response.blob();
            const fileURL = URL.createObjectURL(blob);
            window.open(fileURL, '_blank');
        } else {
            alert("PDF generation failed.");
        }
    } catch (err) {
        console.error(err);
        alert("Server error during PDF creation.");
    }
}

loadSavedState();
updateUI();