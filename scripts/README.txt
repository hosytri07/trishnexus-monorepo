========================================
 TrishNexus - HUONG DAN DAI DOT
========================================

Dung 3 file .bat nay de khong can nho lenh gi het.


--------------------
 CACH DUNG HANG NGAY
--------------------

  SANG  -->  double-click  START.bat
  TOI   -->  double-click  END.bat

Xong. Chi co vay thoi.


----------------------
 KHI DOI SANG MAY MOI
----------------------

Lan dau tien cam USB vao mot may khac:

  1. Cai truoc (neu chua co):
     - Python 3.11+       https://www.python.org/downloads/
       (NHO tick "Add Python to PATH")
     - Git                https://git-scm.com/download/win
     - Claude Desktop     (Tri da co)

  2. Double-click  SETUP.bat  (chay 1 lan duy nhat)

  3. Tu lan sau  --> chi bam START.bat vao sang
                  --> END.bat vao toi


--------------------
 TUNG FILE LAM GI
--------------------

  START.bat
    - Keo code moi nhat tu GitHub ve USB
    - Hien cac file con dang do (neu co)
    - Sau do ban mo Cowork Desktop, lam viec nhu binh thuong

  END.bat
    - Kiem tra co gi thay doi khong
    - Neu co: hoi ban mo ta ngan, tu dong luu va day len GitHub
    - Neu khong: bao "khong co gi thay doi"
    - Nhac ban eject USB an toan

  SETUP.bat
    - Chay 1 lan khi doi may
    - Kiem tra Python + Git da cai chua
    - Cau hinh Git voi account hosytri07
    - Tao moi truong Python (.venv) rieng cho may do
    - Cai cac package trishteam-core, trishdesign, trishfont


-------------------
 KHI CO LOI GI LO
-------------------

Script se in ra "[!] ..." kem goi y.

Neu khong hieu -> mo Cowork Desktop,
nhan tin cho Claude kem noi dung loi.
Dung hoang, data van an toan tren GitHub.


----------------------------------------
 LUU Y QUAN TRONG
----------------------------------------

- KHONG rut USB khi chua chay END.bat xong.
  Data chua kip day len GitHub = co the mat.

- Drive letter co the khac nhau moi may
  (may nha la G:, may co quan co the la E:/F:).
  Khong sao - cac script tu dung "duong dan tuong doi"
  nen van chay duoc.

- File .venv KHONG dung chung duoc giua 2 may.
  Moi may SETUP.bat 1 lan de tao rieng.
  -> May tinh tu biet dung cai nao.

- Cac file  .venv/  __pycache__/  *.pyc  -->  KHONG day len GitHub
  (da co .gitignore xu ly).


========================================
 Moi van de khac  -->  hoi Claude trong Cowork.
========================================
